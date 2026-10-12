/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ComparisonResult, EmployeeProfile } from '../engine/types.ts';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'rep';
  content: string;
  comparison?: ComparisonResult;
  timestamp: number;
  isStreaming?: boolean;
}

export interface TicketAnswer {
  text: string;
  value?: number; // e.g. 350
  effectiveFrom?: string; // e.g. "1/1"
  fieldUpdated?: keyof EmployeeProfile | 'participation';
}

export interface SupportTicket {
  id: string;
  sessionId: string;
  question: string;
  summary: string;
  status: 'open' | 'answered' | 'closed';
  profile: EmployeeProfile;
  lastComparison?: ComparisonResult;
  transcript: ChatMessage[];
  answer?: TicketAnswer;
  createdAt: number;
  answeredAt?: number;
}

export interface StorageAdapter {
  // Session & Profile
  loadProfile(sessionId: string): Promise<EmployeeProfile | null>;
  saveProfile(sessionId: string, profile: EmployeeProfile): Promise<void>;

  // Messages
  loadMessages(sessionId: string): Promise<ChatMessage[]>;
  saveMessages(sessionId: string, messages: ChatMessage[]): Promise<void>;
  addMessage(sessionId: string, message: ChatMessage): Promise<void>;

  // Last Comparison
  loadLastComparison(sessionId: string): Promise<ComparisonResult | null>;
  saveLastComparison(sessionId: string, comparison: ComparisonResult | null): Promise<void>;

  // Tickets
  listTickets(): Promise<SupportTicket[]>;
  getTicket(id: string): Promise<SupportTicket | null>;
  saveTicket(ticket: SupportTicket): Promise<void>;
  onTicketsChange(callback: (tickets: SupportTicket[]) => void): () => void;
}
