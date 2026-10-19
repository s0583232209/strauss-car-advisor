/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Data Access Layer contract. The business logic talks only to this interface;
 * the client never reaches storage (Supabase is called with the server key only).
 */

import type { ChatMessage, ComparisonResult, EmployeeProfile, Rules, SupportTicket, UserRole, VehicleLookupResult } from '../../shared/types.ts';

export interface SessionRecord {
  id: string;
  /** The logged-in user who owns the conversation; absent only without login (development) */
  userId?: string;
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
  /** The user's most recently updated conversation, or null */
  findLatestSessionId(userId: string): Promise<string | null>;
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

  /** Role from app_users; null = no row (the user may not use the app) */
  getUserRole(userId: string): Promise<UserRole | null>;
}

/** Tokens from the identity provider; they go to the browser only as httpOnly cookies */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  /** Seconds until the access token expires */
  expiresIn: number;
  user: { id: string; email: string };
}

export type AuthAttempt = { ok: true; tokens: AuthTokens } | { ok: false; reason: 'invalid' | 'rate_limited' };

/** Identity provider (Supabase Auth). Network failures throw; wrong credentials do not. */
export interface AuthGateway {
  signInWithPassword(email: string, password: string): Promise<AuthAttempt>;
  refresh(refreshToken: string): Promise<AuthAttempt>;
  /** The user an access token belongs to; null when the token is invalid or expired */
  getUser(accessToken: string): Promise<{ id: string; email: string } | null>;
  /** Revokes the refresh token behind this access token (best effort) */
  signOut(accessToken: string): Promise<void>;
}

export const toLookupResult = (r: TaxRecord): VehicleLookupResult => ({
  value: r.benefitValue,
  sourceRow: r.sourceRow,
  commercialName: r.commercialName,
  driveCode: r.driveCode,
  listPrice: r.listPrice,
});
