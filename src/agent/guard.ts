/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Guardrail check: Ensures the LLM did not hallucinate or invent any numbers.
 * Every numeric value mentioned in the bot response must originate from either:
 * - User messages
 * - Tool outputs from this conversation turn
 * - Common policy constants (e.g. 250, 4, 23, 2025, 2026, 50, 100, 1, 2, 3)
 */
export function verifyNumbersInResponse(
  responseText: string,
  allowedSources: string[]
): { passed: boolean; inventedNumbers: number[] } {
  // Extract all numbers from text
  const cleanSourceText = allowedSources.join(' ').replace(/[,₪%]/g, ' ');
  const sourceNumbers = new Set(
    (cleanSourceText.match(/\b\d+(\.\d+)?\b/g) || []).map(Number)
  );

  // Common benign constants and years
  const benignWhitelist = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 23, 50, 100, 250, 2024, 2025, 2026, 2027]);

  const responseNumbers = (responseText.replace(/[,₪%]/g, ' ').match(/\b\d+(\.\d+)?\b/g) || []).map(Number);

  const invented: number[] = [];

  for (const num of responseNumbers) {
    if (benignWhitelist.has(num)) continue;
    if (!sourceNumbers.has(num)) {
      // Check if integer version matches
      const intVal = Math.round(num);
      if (!sourceNumbers.has(intVal)) {
        invented.push(num);
      }
    }
  }

  return {
    passed: invented.length === 0,
    inventedNumbers: invented,
  };
}
