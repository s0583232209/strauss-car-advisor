/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { agentLog } from './debugLog.ts';
import { verifyNumbersInResponse } from './guard.ts';
import { callLlm, LlmDeadlineError, LlmMessage } from './llm.ts';
import { describeProfileCard } from './profileStatus.ts';
import { SYSTEM_PROMPT } from './prompt.ts';
import { numberedLine } from './carSearch.ts';
import { parseQuickAnswer } from './quickAnswer.ts';
import { AGENT_TOOLS_DEFINITIONS, ASK_AT_ONCE, executeTool, getMissingFields, toolStatus } from './tools.ts';
import { AgentContext } from './types.ts';

/** Text that imitates a tool call ("[קריאה לכלי x]: ..." / "[תוצאת כלי x]: ...") instead of calling it */
const PSEUDO_TOOL_TEXT = /^\s*\[(קריאה לכלי|תוצאת כלי)\s/;

export interface TurnResult {
  text: string;
  isThrottled?: boolean;
  /** Fields the bot asked and the employee has not answered yet; pass back as context.pendingFields */
  pendingFields?: string[];
}

/** Shown while the model reads the employee message, and while it writes after a tool ran */
export const STATUS_THINKING_HE = 'קורא את ההודעה...';
export const STATUS_WRITING_HE = 'מנסח תשובה...';

const TIMEOUT_TEXT = 'הבקשה ארכה מעל לזמן המותר (30 שניות). מוצגים נתוני ההשוואה העדכניים שנשמרו עד כה.';

/**
 * Runs a complete agent conversation turn with local tool execution,
 * tool-loop cap at 6 calls, 30s timeout, and strict number guardrails.
 * onStatus gets a short Hebrew line for what the agent is doing now (model call or tool).
 */
export async function runAgentTurn(
  userMessage: string,
  history: Array<{ role: 'user' | 'assistant' | 'system' | 'rep'; content: string }>,
  context: AgentContext,
  onThrottled?: (isThrottled: boolean, message?: string) => void,
  onStatus?: (status: string) => void
): Promise<TurnResult> {
  const timeoutMs = 30000;
  const startTime = Date.now();
  // Enforced inside callLlm too, so one slow model call cannot run past the turn limit
  const deadline = startTime + timeoutMs;

  // A bare list choice ("1") is sent together with the list line it points to
  const lastBotText = [...history].reverse().find((h) => h.role === 'assistant')?.content;
  context.lastBotText = lastBotText;
  const choice = userMessage.trim().match(/^\d+$/) ? numberedLine(lastBotText, Number(userMessage.trim())) : undefined;
  const userMessageForModel = choice
    ? `${userMessage} (בחירה מספר ${userMessage.trim()} מהרשימה שהצגת: "${choice}")`
    : userMessage;

  // Before any answer: the greeting asks the first fields on the missing list
  if (context.pendingFields === undefined) {
    context.pendingFields = getMissingFields(context.profile).slice(0, ASK_AT_ONCE).map((m) => m.field);
  }
  context.askedFields = undefined;

  const conversation: LlmMessage[] = [
    ...history
      .slice(-10)
      // Drop pseudo tool-call text saved by older versions; it teaches the model to imitate it
      .filter((h) => !PSEUDO_TOOL_TEXT.test(h.content))
      .map((h): LlmMessage => ({
        role: h.role === 'assistant' ? 'assistant' : 'user',
        content: h.content,
      })),
    { role: 'user', content: userMessageForModel },
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
  // Tool calls already executed in this turn (name + args), to block repeat loops
  const executedCalls = new Set<string>();

  agentLog.turnStart(userMessage, context.profile, context.repParticipationMode);
  const finish = (reason: string, result: TurnResult): TurnResult => {
    agentLog.turnEnd(reason, result.text);
    // What the tools told the bot to ask this turn, else what was pending before; only still-missing fields
    const missingNow = new Set(getMissingFields(context.profile).map((m) => m.field));
    const pending = (context.askedFields ?? context.pendingFields ?? []).filter((f) => missingNow.has(f));
    return { ...result, pendingFields: pending };
  };

  // A simple answer to the last question ("פנסיה 6, קרן 2.5") is saved in code, so the model
  // does not spend a call choosing update_profile; it only writes the reply (see quickAnswer.ts)
  let quickNote = '';
  const quick = choice ? null : parseQuickAnswer(userMessage, context.pendingFields);
  if (quick) {
    onStatus?.(toolStatus('update_profile'));
    agentLog.quickAnswer(Object.keys(quick));
    const { result, outputTextForGuardrail } = await executeTool('update_profile', quick, context);
    agentLog.toolResult('update_profile', quick, result, context.profile);
    executedCalls.add(`update_profile:${JSON.stringify(quick)}`);
    if (outputTextForGuardrail) toolOutputsThisTurn.push(outputTextForGuardrail);
    quickNote =
      `\n\nהמערכת כבר הפעילה update_profile על ההודעה האחרונה של העובד, וזו התוצאה: ${JSON.stringify(result)}\n` +
      'אל תפעיל update_profile או get_missing_fields על ההודעה הזו (stillMissing כבר בתוצאה). ' +
      'ענה לעובד ישירות: אשר בקצרה מה נקלט, והמשך לפי stillMissing או nextStep_he.';
  }

  while (loopCount < MAX_TOOL_CALLS) {
    if (Date.now() >= deadline) {
      return finish('timeout after 30s', { text: TIMEOUT_TEXT });
    }

    loopCount++;
    agentLog.round(loopCount, MAX_TOOL_CALLS, Date.now() - startTime);
    onStatus?.(loopCount === 1 ? STATUS_THINKING_HE : STATUS_WRITING_HE);

    // Fresh card snapshot every call, so the model sees what is already known
    // Card values are already allowed by the guard through `profile`
    const card = describeProfileCard(context.profile);

    let response;
    try {
      response = await callLlm({
        messages: conversation,
        tools: AGENT_TOOLS_DEFINITIONS,
        systemInstruction: `${SYSTEM_PROMPT}\n\n${card}${quickNote}`,
        preferredModel: turnModel,
        deadline,
        onThrottled,
      });
    } catch (err) {
      if (err instanceof LlmDeadlineError) return finish('timeout after 30s (inside a model call)', { text: TIMEOUT_TEXT });
      agentLog.turnEnd(`error: ${err instanceof Error ? err.message : String(err)}`, '');
      throw err;
    }
    if (response.model) turnModel = response.model;
    agentLog.modelReply(response.model, response.functionCalls, response.text || '');

    // Handle function calls: send them back as real functionCall / functionResponse turns
    if (response.functionCalls && response.functionCalls.length > 0) {
      const responses: Array<{ name: string; id?: string; response: Record<string, unknown> }> = [];
      for (const call of response.functionCalls) {
        const callKey = `${call.name}:${JSON.stringify(call.args ?? {})}`;
        const isRepeat = executedCalls.has(callKey);
        executedCalls.add(callKey);
        if (isRepeat) agentLog.repeatSkipped(call.name);
        else onStatus?.(toolStatus(call.name));

        const { result, outputTextForGuardrail } = isRepeat
          ? {
              result: {
                skipped: true,
                message: 'הכלי כבר הופעל עם אותם פרמטרים בתשובה זו. אל תפעיל אותו שוב: השתמש בתוצאה הקודמת ובכרטיס העובד וענה למשתמש.',
              },
              outputTextForGuardrail: '',
            }
          : await executeTool(call.name, call.args, context);
        if (!isRepeat) agentLog.toolResult(call.name, call.args, result, context.profile);

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
      agentLog.pseudoToolText();
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
      return finish('answered', { text: candidateText });
    }
    agentLog.guardrailFailed(guardrail.inventedNumbers);

    // Guardrail triggered: attempt 1 regeneration with correction
    if (loopCount < MAX_TOOL_CALLS) {
      conversation.push({
        role: 'user',
        content: `שים לב: אסור להמציא או לחשב מספרים בעצמך. המספרים ${guardrail.inventedNumbers.join(', ')} לא הופיעו בנתוני המערכת. נסח מחדש בקצרה בלי מספרים מומצאים, או הפנה לכרטיס ההשוואה המופיע מטה.`,
      });
      continue;
    }

    // If still failing after regeneration attempts, provide safe fallback
    return finish('number guard failed on last round', {
      text: 'מצורף למטה כרטיס השוואת השכר המפורט ומדויק על פי נתוני המחשבון:',
    });
  }

  return finish(`hit the ${MAX_TOOL_CALLS}-round limit (loop)`, {
    text: 'סיימתי את חישוב הנתונים. כרטיס ההשוואה המלא מופיע למטה.',
  });
}
