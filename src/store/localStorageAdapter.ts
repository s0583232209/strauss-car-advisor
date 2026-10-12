/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ComparisonResult, EmployeeProfile } from '../engine/types.ts';
import { ChatMessage, StorageAdapter, SupportTicket } from './types.ts';

const memoryStore = new Map<string, string>();

function safeGetItem(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
  } catch {
    // LocalStorage blocked or error
  }
  return memoryStore.get(key) || null;
}

function safeSetItem(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
  } catch {
    // LocalStorage blocked or quota error
  }
  memoryStore.set(key, value);
}

export class LocalStorageAdapter implements StorageAdapter {
  private ticketListeners = new Set<(tickets: SupportTicket[]) => void>();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === 'yoetz_tickets') {
          this.notifyTicketsChanged();
        }
      });
    }
  }

  private notifyTicketsChanged() {
    this.listTickets().then((tickets) => {
      for (const listener of this.ticketListeners) {
        try {
          listener(tickets);
        } catch (err) {
          console.error('Error in ticket listener:', err);
        }
      }
    });
  }

  async loadProfile(sessionId: string): Promise<EmployeeProfile | null> {
    const raw = safeGetItem(`yoetz_profile_${sessionId}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async saveProfile(sessionId: string, profile: EmployeeProfile): Promise<void> {
    safeSetItem(`yoetz_profile_${sessionId}`, JSON.stringify(profile));
  }

  async loadMessages(sessionId: string): Promise<ChatMessage[]> {
    const raw = safeGetItem(`yoetz_messages_${sessionId}`);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  async saveMessages(sessionId: string, messages: ChatMessage[]): Promise<void> {
    safeSetItem(`yoetz_messages_${sessionId}`, JSON.stringify(messages));
  }

  async addMessage(sessionId: string, message: ChatMessage): Promise<void> {
    const list = await this.loadMessages(sessionId);
    list.push(message);
    await this.saveMessages(sessionId, list);
  }

  async loadLastComparison(sessionId: string): Promise<ComparisonResult | null> {
    const raw = safeGetItem(`yoetz_last_comp_${sessionId}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async saveLastComparison(sessionId: string, comparison: ComparisonResult | null): Promise<void> {
    if (comparison === null) {
      safeSetItem(`yoetz_last_comp_${sessionId}`, '');
    } else {
      safeSetItem(`yoetz_last_comp_${sessionId}`, JSON.stringify(comparison));
    }
  }

  async listTickets(): Promise<SupportTicket[]> {
    const raw = safeGetItem('yoetz_tickets');
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  async getTicket(id: string): Promise<SupportTicket | null> {
    const all = await this.listTickets();
    return all.find((t) => t.id === id) || null;
  }

  async saveTicket(ticket: SupportTicket): Promise<void> {
    const all = await this.listTickets();
    const idx = all.findIndex((t) => t.id === ticket.id);
    if (idx >= 0) {
      all[idx] = ticket;
    } else {
      all.unshift(ticket);
    }
    safeSetItem('yoetz_tickets', JSON.stringify(all));
    this.notifyTicketsChanged();
  }

  onTicketsChange(callback: (tickets: SupportTicket[]) => void): () => void {
    this.ticketListeners.add(callback);
    // Initial emission
    this.listTickets().then((t) => callback(t));

    // Polling every 2s to detect changes in other tabs or frames
    const interval = setInterval(() => {
      this.listTickets().then((t) => callback(t));
    }, 2000);

    return () => {
      this.ticketListeners.delete(callback);
      clearInterval(interval);
    };
  }
}
