/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { verifyNumbersInResponse } from './guard.ts';
import { callLlm } from './llm.ts';
import { SYSTEM_PROMPT } from './prompt.ts';
import { AGENT_TOOLS_DEFINITIONS, executeTool } from './tools.ts';
import { AgentContext } from './types.ts';

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

  const conversation = [
    ...history.slice(-10).map((h) => ({
      role: h.role === 'assistant' ? 'assistant' : 'user',
      content: h.content,
    })),
    { role: 'user', content: userMessage },
  ];

  const allowedSourcesForGuardrail: string[] = [
    userMessage,
    ...history.map((h) => h.content),
  ];

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
      onThrottled,
    });

    // Handle function calls
    if (response.functionCalls && response.functionCalls.length > 0) {
      for (const call of response.functionCalls) {
        const { result, outputTextForGuardrail } = await executeTool(
          call.name,
          call.args,
          context
        );

        if (outputTextForGuardrail) {
          allowedSourcesForGuardrail.push(outputTextForGuardrail);
        }

        // Add tool interaction to message chain for next model turn
        conversation.push({
          role: 'assistant',
          content: `[קריאה לכלי ${call.name}]: ${JSON.stringify(call.args)}`,
        });
        conversation.push({
          role: 'user',
          content: `[תוצאת כלי ${call.name}]: ${JSON.stringify(result)}`,
        });
      }
      continue;
    }

    // Final text returned by model
    const candidateText = response.text || '';

    // Run guardrail verification on numbers
    const guardrail = verifyNumbersInResponse(candidateText, allowedSourcesForGuardrail);

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
