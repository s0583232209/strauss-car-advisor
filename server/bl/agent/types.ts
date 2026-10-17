/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ComparisonResult, EmployeeProfile, ScenarioType } from '../engine/types.ts';

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'OBJECT';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface AgentContext {
  profile: EmployeeProfile;
  lastComparison: ComparisonResult | null;
  repParticipationMode: boolean; // Demo mode: whether new car participation requires rep confirmation
  // The employee's own messages in this conversation. When set, update_profile saves only
  // numbers that appear here (set by runAgentTurn; omitted in engine-only checks).
  userTexts?: string[];
  // The bot's previous message, so a list choice like "1" maps to line 1 of that list
  lastBotText?: string;
  // Fields asked in the previous bot message; while one is missing, no new field is asked
  pendingFields?: string[];
  // Set by the tools: fields the bot was told to ask in this turn (becomes pendingFields next turn)
  askedFields?: string[];
  onProfileUpdate: (updated: Partial<EmployeeProfile>) => void;
  onComparisonRun: (comp: ComparisonResult) => void;
  onEscalate: (question: string, summary: string) => Promise<string>;
}

export interface MissingFieldInfo {
  field: string;
  label_he: string;
  whyNeeded_he: string;
}
