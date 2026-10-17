/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Data Access Layer contract. The business logic talks only to this interface;
 * the client never reaches storage (Supabase is called with the server key only).
 */

import type { ChatMessage, ComparisonResult, EmployeeProfile, Rules, SupportTicket, VehicleLookupResult } from '../../shared/types.ts';

export interface SessionRecord {
  id: string;
  profile: EmployeeProfile;
  lastComparison: ComparisonResult | null;
  /** Fields the bot asked and the employee has not answered yet (agent state, never sent to the client) */
  pendingFields?: string[];
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

/** One row of the Tax Authority benefit-value file, keyed by "regYear|vehicleType|productCode|modelCode" */
export interface TaxRecord {
  key: string;
  regYear: string;
  vehicleType: string;
  productCode: string;
  modelCode: string;
  commercialName: string;
  benefitValue: number;
  driveCode: number;
  listPrice: number;
  sourceRow: number;
}

export interface Repository {
  readonly kind: 'supabase' | 'file';

  getSession(id: string): Promise<SessionRecord | null>;
  /** Saves everything but the messages */
  saveSessionState(session: Omit<SessionRecord, 'messages'>): Promise<void>;
  appendMessages(sessionId: string, messages: ChatMessage[]): Promise<void>;
  /** Replaces the whole conversation (new conversation) */
  replaceMessages(sessionId: string, messages: ChatMessage[]): Promise<void>;

  listTickets(): Promise<SupportTicket[]>;
  listTicketsForSession(sessionId: string): Promise<SupportTicket[]>;
  getTicket(id: string): Promise<SupportTicket | null>;
  saveTicket(ticket: SupportTicket): Promise<void>;

  /** Admin rules override; null = built-in rules */
  getRules(): Promise<Rules | null>;
  saveRules(rules: Rules | null): Promise<void>;

  saveTaxRecords(records: TaxRecord[]): Promise<void>;
  getTaxRecord(key: string): Promise<VehicleLookupResult | null>;
  countTaxRecords(): Promise<number>;
  clearTaxRecords(): Promise<void>;
}

export const toLookupResult = (r: TaxRecord): VehicleLookupResult => ({
  value: r.benefitValue,
  sourceRow: r.sourceRow,
  commercialName: r.commercialName,
  driveCode: r.driveCode,
  listPrice: r.listPrice,
});
