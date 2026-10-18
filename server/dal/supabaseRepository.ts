/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Production store: Supabase over its REST API (PostgREST), called only from the server with
 * SUPABASE_SERVICE_ROLE_KEY. RLS is enabled with no policies (supabase/schema.sql), so the anon
 * key cannot read anything: the client never talks to the database.
 * Errors are thrown, never hidden behind a local fallback.
 */

import type { ChatMessage, Rules, SupportTicket, UserRole, VehicleLookupResult } from '../../shared/types.ts';
import { Repository, SessionRecord, TaxRecord, toLookupResult } from './types.ts';

const TAX_BATCH = 1000;
const iso = (ms: number) => new Date(ms).toISOString();
const ms = (s: string | null | undefined) => (s ? new Date(s).getTime() : 0);

export class SupabaseRepository implements Repository {
  readonly kind = 'supabase' as const;

  constructor(private readonly url: string, private readonly serviceKey: string) {}

  private async request(pathAndQuery: string, init: RequestInit & { prefer?: string } = {}): Promise<Response> {
    const res = await fetch(`${this.url}/rest/v1/${pathAndQuery}`, {
      ...init,
      headers: {
        apikey: this.serviceKey,
        Authorization: `Bearer ${this.serviceKey}`,
        'Content-Type': 'application/json',
        ...(init.prefer ? { Prefer: init.prefer } : {}),
        ...(init.headers as Record<string, string> | undefined),
      },
    });
    if (!res.ok) {
      // The body may echo row data: log only status and table
      throw new Error(`Supabase ${init.method ?? 'GET'} ${pathAndQuery.split('?')[0]} failed (${res.status})`);
    }
    return res;
  }

  private async rows<T>(pathAndQuery: string): Promise<T[]> {
    return (await this.request(pathAndQuery)).json() as Promise<T[]>;
  }

  private upsert(table: string, body: unknown): Promise<Response> {
    return this.request(table, {
      method: 'POST',
      body: JSON.stringify(body),
      prefer: 'resolution=merge-duplicates,return=minimal',
    });
  }

  async getSession(id: string): Promise<SessionRecord | null> {
    const enc = encodeURIComponent(id);
    const [session] = await this.rows<any>(`sessions?id=eq.${enc}&select=*`);
    if (!session) return null;
    const messages = await this.rows<any>(`messages?session_id=eq.${enc}&order=created_at.asc,id.asc&select=*`);
    return {
      id: session.id,
      profile: session.profile ?? {},
      lastComparison: session.last_comparison ?? null,
      pendingFields: session.pending_fields ?? undefined,
      createdAt: ms(session.created_at),
      updatedAt: ms(session.updated_at),
      messages: messages.map(
        (m): ChatMessage => ({
          id: m.id,
          role: m.role,
          content: m.content,
          ...(m.metadata?.comparison ? { comparison: m.metadata.comparison } : {}),
          timestamp: ms(m.created_at),
        })
      ),
    };
  }

  async saveSessionState(s: Omit<SessionRecord, 'messages'>): Promise<void> {
    await this.upsert('sessions', {
      id: s.id,
      profile: s.profile,
      last_comparison: s.lastComparison,
      pending_fields: s.pendingFields ?? null,
      created_at: iso(s.createdAt),
      updated_at: iso(s.updatedAt),
    });
  }

  private messageRow(sessionId: string, m: ChatMessage) {
    return {
      id: m.id,
      session_id: sessionId,
      role: m.role,
      content: m.content,
      metadata: m.comparison ? { comparison: m.comparison } : {},
      created_at: iso(m.timestamp),
    };
  }

  async appendMessages(sessionId: string, messages: ChatMessage[]): Promise<void> {
    if (messages.length === 0) return;
    await this.upsert('messages', messages.map((m) => this.messageRow(sessionId, m)));
  }

  async replaceMessages(sessionId: string, messages: ChatMessage[]): Promise<void> {
    await this.request(`messages?session_id=eq.${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
    await this.appendMessages(sessionId, messages);
  }

  private toTicket(row: any): SupportTicket {
    return {
      id: row.id,
      sessionId: row.session_id,
      question: row.question,
      summary: row.summary,
      status: row.status,
      profile: row.profile ?? {},
      lastComparison: row.last_comparison ?? undefined,
      transcript: row.transcript ?? [],
      answer: row.answer ?? undefined,
      createdAt: ms(row.created_at),
      answeredAt: row.answered_at ? ms(row.answered_at) : undefined,
    };
  }

  async listTickets(): Promise<SupportTicket[]> {
    return (await this.rows<any>('tickets?order=created_at.desc&select=*')).map((r) => this.toTicket(r));
  }

  async listTicketsForSession(sessionId: string): Promise<SupportTicket[]> {
    return (await this.rows<any>(`tickets?session_id=eq.${encodeURIComponent(sessionId)}&order=created_at.desc&select=*`)).map((r) => this.toTicket(r));
  }

  async getTicket(id: string): Promise<SupportTicket | null> {
    const [row] = await this.rows<any>(`tickets?id=eq.${encodeURIComponent(id)}&select=*`);
    return row ? this.toTicket(row) : null;
  }

  async saveTicket(t: SupportTicket): Promise<void> {
    await this.upsert('tickets', {
      id: t.id,
      session_id: t.sessionId,
      question: t.question,
      summary: t.summary,
      status: t.status,
      profile: t.profile,
      last_comparison: t.lastComparison ?? null,
      transcript: t.transcript,
      answer: t.answer ?? null,
      created_at: iso(t.createdAt),
      answered_at: t.answeredAt ? iso(t.answeredAt) : null,
    });
  }

  async getRules(): Promise<Rules | null> {
    const [row] = await this.rows<any>('app_settings?key=eq.rules&select=value');
    return row?.value ?? null;
  }

  async saveRules(rules: Rules | null): Promise<void> {
    if (rules === null) {
      await this.request('app_settings?key=eq.rules', { method: 'DELETE' });
      return;
    }
    await this.upsert('app_settings', { key: 'rules', value: rules, updated_at: new Date().toISOString() });
  }

  async saveTaxRecords(records: TaxRecord[]): Promise<void> {
    for (let i = 0; i < records.length; i += TAX_BATCH) {
      await this.upsert(
        'tax_records',
        records.slice(i, i + TAX_BATCH).map((r) => ({
          key: r.key,
          reg_year: r.regYear,
          vehicle_type: r.vehicleType,
          product_code: r.productCode,
          model_code: r.modelCode,
          commercial_name: r.commercialName,
          benefit_value: r.benefitValue,
          drive_code: r.driveCode,
          list_price: r.listPrice,
          source_row: r.sourceRow,
        }))
      );
    }
  }

  async getTaxRecord(key: string): Promise<VehicleLookupResult | null> {
    const [r] = await this.rows<any>(`tax_records?key=eq.${encodeURIComponent(key)}&select=*`);
    if (!r) return null;
    return toLookupResult({
      key: r.key,
      regYear: r.reg_year,
      vehicleType: r.vehicle_type,
      productCode: r.product_code,
      modelCode: r.model_code,
      commercialName: r.commercial_name ?? '',
      benefitValue: Number(r.benefit_value),
      driveCode: Number(r.drive_code),
      listPrice: Number(r.list_price),
      sourceRow: Number(r.source_row),
    });
  }

  async countTaxRecords(): Promise<number> {
    const res = await this.request('tax_records?select=key', {
      method: 'HEAD',
      prefer: 'count=exact',
      headers: { Range: '0-0' },
    } as RequestInit & { prefer: string });
    // Content-Range: "0-0/1234" or "*/0"
    const total = res.headers.get('content-range')?.split('/')[1];
    return total ? Number(total) || 0 : 0;
  }

  async clearTaxRecords(): Promise<void> {
    await this.request('tax_records?key=not.is.null', { method: 'DELETE' });
  }

  async getUserRole(userId: string): Promise<UserRole | null> {
    const [row] = await this.rows<{ role: UserRole }>(`app_users?user_id=eq.${encodeURIComponent(userId)}&select=role`);
    return row?.role ?? null;
  }
}
