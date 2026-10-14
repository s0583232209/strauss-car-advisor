/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { verifyNumbersInResponse } from './guard.ts';
import { callLlm, LlmMessage } from './llm.ts';
import { SYSTEM_PROMPT } from './prompt.ts';
import { AGENT_TOOLS_DEFINITIONS, executeTool } from './tools.ts';
import { AgentContext } from './types.ts';

/** Text that imitates a tool call ("[קריאה לכלי x]: ..." / "[תוצאת כלי x]: ...") instead of calling it */
const PSEUDO_TOOL_TEXT = /^\s*\[(קריאה לכלי|תוצאת כלי)\s/;

export interface TurnResult {
  text: string;
  isThrottled?: boolean;
}

/**
 * Runs a complete agent conversation turn with local tool execution,
 * tool-loop cap at 6 calls, 30s timeout, and strict number guardrails.
 */
export async function runAgentTurn(
  userMessage: string,
  history: Array<{ role: 'user' | 'assistant' | 'system' | 'rep'; content: string }>,
  context: AgentContext,
  onThrottled?: (isThrottled: boolean, message?: string) => void
): Promise<TurnResult> {
  const timeoutMs = 30000;
  const startTime = Date.now();

  const conversation: LlmMessage[] = [
    ...history
      .slice(-10)
      // Drop pseudo tool-call text saved by older versions; it teaches the model to imitate it
      .filter((h) => !PSEUDO_TOOL_TEXT.test(h.content))
      .map((h): LlmMessage => ({
        role: h.role === 'assistant' ? 'assistant' : 'user',
        content: h.content,
      })),
    { role: 'user', content: userMessage },
  ];
  // Model that answered the previous call in this turn (thought signatures are model-specific)
  let turnModel: string | undefined;

  // Guardrail sources: this turn's tool outputs, and what people (not the bot) wrote
  const toolOutputsThisTurn: string[] = [];
  const peopleTexts = [...history.filter((h) => h.role !== 'assistant').map((h) => h.content), userMessage];

  // Profile values may only come from what the employee wrote (not the bot, not tool outputs)
  context.userTexts = [...history.filter((h) => h.role === 'user').map((h) => h.content), userMessage];

  let loopCount = 0;
  const MAX_TOOL_CALLS = 6;

  while (loopCount < MAX_TOOL_CALLS) {
    if (Date.now() - startTime > timeoutMs) {
      return {
        text: 'הבקשה ארכה מעל לזמן המותר (30 שניות). מוצגים נתוני ההשוואה העדכניים שנשמרו עד כה.',
      };
    }

    loopCount++;

    const response = await callLlm({
      messages: conversation,
      tools: AGENT_TOOLS_DEFINITIONS,
      systemInstruction: SYSTEM_PROMPT,
      preferredModel: turnModel,
      onThrottled,
    });
    if (response.model) turnModel = response.model;

    // Handle function calls: send them back as real functionCall / functionResponse turns
    if (response.functionCalls && response.functionCalls.length > 0) {
      const responses: Array<{ name: string; id?: string; response: Record<string, unknown> }> = [];
      for (const call of response.functionCalls) {
        const { result, outputTextForGuardrail } = await executeTool(
          call.name,
          call.args,
          context
        );

        if (outputTextForGuardrail) {
          toolOutputsThisTurn.push(outputTextForGuardrail);
        }

        // functionResponse.response must be a JSON object
        const asObject =
          result && typeof result === 'object' && !Array.isArray(result) ? result : { result };
        responses.push({ name: call.name, ...(call.id ? { id: call.id } : {}), response: asObject });
      }

      conversation.push({
        role: 'model_content',
        content: response.modelContent ?? {
          role: 'model',
          parts: response.functionCalls.map((c) => ({ functionCall: { name: c.name, args: c.args } })),
        },
      });
      conversation.push({ role: 'tool_responses', responses });
      continue;
    }

    // Final text returned by model
    const candidateText = response.text || '';

    // The model wrote a tool call as text instead of calling the tool: ask again
    if (PSEUDO_TOOL_TEXT.test(candidateText) && loopCount < MAX_TOOL_CALLS) {
      conversation.push({ role: 'assistant', content: candidateText });
      conversation.push({
        role: 'user',
        content: 'אל תכתוב קריאה לכלי כטקסט. אם צריך כלי, הפעל אותו באמת; אחרת ענה למשתמש בעברית.',
      });
      continue;
    }

    // Run guardrail verification on numbers
    const guardrail = verifyNumbersInResponse(candidateText, {
      toolOutputs: toolOutputsThisTurn,
      userTexts: peopleTexts,
      profile: context.profile,
    });

    if (guardrail.passed) {
      return { text: candidateText };
    }

    // Guardrail triggered: attempt 1 regeneration with correction
    if (loopCount < MAX_TOOL_CALLS) {
      conversation.push({
        role: 'user',
        content: `שים לב: אסור להמציא או לחשב מספרים בעצמך. המספרים ${guardrail.inventedNumbers.join(', ')} לא הופיעו בנתוני המערכת. נסח מחדש בקצרה בלי מספרים מומצאים, או הפנה לכרטיס ההשוואה המופיע מטה.`,
      });
      continue;
    }

    // If still failing after regeneration attempts, provide safe fallback
    return {
      text: 'מצורף למטה כרטיס השוואת השכר המפורט ומדויק על פי נתוני המחשבון:',
    };
  }

  return {
    text: 'סיימתי את חישוב הנתונים. כרטיס ההשוואה המלא מופיע למטה.',
  };
}
