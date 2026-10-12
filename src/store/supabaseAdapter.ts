/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ComparisonResult, EmployeeProfile } from '../engine/types.ts';
import { LocalStorageAdapter } from './localStorageAdapter.ts';
import { ChatMessage, StorageAdapter, SupportTicket } from './types.ts';

export class SupabaseAdapter implements StorageAdapter {
  private fallback: LocalStorageAdapter;
  private supabaseUrl: string;
  private supabaseKey: string;
  private isConfigured: boolean;

  constructor() {
    this.fallback = new LocalStorageAdapter();
    this.supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || '';
    this.supabaseKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || '';
    this.isConfigured = Boolean(this.supabaseUrl && this.supabaseKey);
  }

  get isConnected(): boolean {
    return this.isConfigured;
  }

  private get headers(): Record<string, string> {
    return {
      'apikey': this.supabaseKey,
      'Authorization': `Bearer ${this.supabaseKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    };
  }

  async loadProfile(sessionId: string): Promise<EmployeeProfile | null> {
    if (!this.isConfigured) return this.fallback.loadProfile(sessionId);
    try {
      const res = await fetch(`${this.supabaseUrl}/rest/v1/sessions?id=eq.${encodeURIComponent(sessionId)}&select=profile`, {
        headers: this.headers,
      });
      if (!res.ok) throw new Error('Fetch failed');
      const data = await res.json();
      if (data && data.length > 0 && data[0].profile) {
        return data[0].profile;
      }
    } catch {
      // Fallback
    }
    return this.fallback.loadProfile(sessionId);
  }

  async saveProfile(sessionId: string, profile: EmployeeProfile): Promise<void> {
    await this.fallback.saveProfile(sessionId, profile);
    if (!this.isConfigured) return;
    try {
      await fetch(`${this.supabaseUrl}/rest/v1/sessions`, {
        method: 'POST',
        headers: { ...this.headers, 'Prefer': 'resolution=merge-duplicates' },
        body: JSON.stringify({
          id: sessionId,
          profile,
          updated_at: new Date().toISOString(),
        }),
      });
    } catch {
      // Offline fallback preserved
    }
  }

  async loadMessages(sessionId: string): Promise<ChatMessage[]> {
    if (!this.isConfigured) return this.fallback.loadMessages(sessionId);
    try {
      const res = await fetch(
        `${this.supabaseUrl}/rest/v1/messages?session_id=eq.${encodeURIComponent(sessionId)}&order=created_at.asc`,
        { headers: this.headers }
      );
      if (!res.ok) throw new Error('Fetch failed');
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data.map((row) => ({
          id: row.id,
          role: row.role,
          content: row.content,
          comparison: row.metadata?.comparison,
          timestamp: new Date(row.created_at).getTime(),
        }));
      }
    } catch {
      // Fallback
    }
    return this.fallback.loadMessages(sessionId);
  }

  async saveMessages(sessionId: string, messages: ChatMessage[]): Promise<void> {
    await this.fallback.saveMessages(sessionId, messages);
  }

  async addMessage(sessionId: string, message: ChatMessage): Promise<void> {
    await this.fallback.addMessage(sessionId, message);
    if (!this.isConfigured) return;
    try {
      await fetch(`${this.supabaseUrl}/rest/v1/messages`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          id: message.id,
          session_id: sessionId,
          role: message.role,
          content: message.content,
          metadata: message.comparison ? { comparison: message.comparison } : {},
          created_at: new Date(message.timestamp).toISOString(),
        }),
      });
    } catch {
      // Fallback preserved
    }
  }

  async loadLastComparison(sessionId: string): Promise<ComparisonResult | null> {
    return this.fallback.loadLastComparison(sessionId);
  }

  async saveLastComparison(sessionId: string, comparison: ComparisonResult | null): Promise<void> {
    await this.fallback.saveLastComparison(sessionId, comparison);
  }

  async listTickets(): Promise<SupportTicket[]> {
    if (!this.isConfigured) return this.fallback.listTickets();
    try {
      const res = await fetch(`${this.supabaseUrl}/rest/v1/tickets?order=created_at.desc`, {
        headers: this.headers,
      });
      if (!res.ok) throw new Error('Fetch failed');
      const data = await res.json();
      if (Array.isArray(data)) {
        return data.map((row) => ({
          id: row.id,
          sessionId: row.session_id,
          question: row.question,
          summary: row.summary,
          status: row.status,
          answer: row.answer,
          profile: row.answer?.profile || ({} as any),
          transcript: [],
          createdAt: new Date(row.created_at).getTime(),
          answeredAt: row.answered_at ? new Date(row.answered_at).getTime() : undefined,
        }));
      }
    } catch {
      // Fallback
    }
    return this.fallback.listTickets();
  }

  async getTicket(id: string): Promise<SupportTicket | null> {
    return this.fallback.getTicket(id);
  }

  async saveTicket(ticket: SupportTicket): Promise<void> {
    await this.fallback.saveTicket(ticket);
    if (!this.isConfigured) return;
    try {
      await fetch(`${this.supabaseUrl}/rest/v1/tickets`, {
        method: 'POST',
        headers: { ...this.headers, 'Prefer': 'resolution=merge-duplicates' },
        body: JSON.stringify({
          id: ticket.id,
          session_id: ticket.sessionId,
          question: ticket.question,
          summary: ticket.summary,
          status: ticket.status,
          answer: ticket.answer || null,
          created_at: new Date(ticket.createdAt).toISOString(),
          answered_at: ticket.answeredAt ? new Date(ticket.answeredAt).toISOString() : null,
        }),
      });
    } catch {
      // Fallback preserved
    }
  }

  onTicketsChange(callback: (tickets: SupportTicket[]) => void): () => void {
    // If Supabase realtime WebSocket is available or fallback polling
    return this.fallback.onTicketsChange(callback);
  }
}

/** Global singleton adapter getter */
let activeAdapter: StorageAdapter | null = null;

export function getStorageAdapter(): StorageAdapter {
  if (!activeAdapter) {
    const hasSupabase = Boolean(
      (import.meta.env.VITE_SUPABASE_URL as string) && (import.meta.env.VITE_SUPABASE_ANON_KEY as string)
    );
    activeAdapter = hasSupabase ? new SupabaseAdapter() : new LocalStorageAdapter();
  }
  return activeAdapter;
}
