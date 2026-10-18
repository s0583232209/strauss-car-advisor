/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Local development store: JSON files in DATA_DIR (default ./.data, git-ignored).
 * Kept in memory and written atomically (temp file + rename) after every change.
 * Single-process only: use Supabase when more than one server instance runs.
 */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ChatMessage, Rules, SupportTicket, UserRole, VehicleLookupResult } from '../../shared/types.ts';
import { Repository, SessionRecord, TaxRecord, toLookupResult } from './types.ts';

interface AppData {
  sessions: Record<string, SessionRecord>;
  tickets: SupportTicket[];
  rules: Rules | null;
}

const emptyData = (): AppData => ({ sessions: {}, tickets: [], rules: null });

export class FileRepository implements Repository {
  readonly kind = 'file' as const;
  private data: AppData | null = null;
  private tax: Map<string, TaxRecord> | null = null;
  // Writes run one after another so two saves never interleave
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly dir: string) {}

  private get appFile() {
    return path.join(this.dir, 'app-data.json');
  }
  private get taxFile() {
    return path.join(this.dir, 'tax-records.json');
  }

  private async readJson<T>(file: string, fallback: T): Promise<T> {
    try {
      return JSON.parse(await readFile(file, 'utf8')) as T;
    } catch (err: any) {
      if (err?.code === 'ENOENT') return fallback;
      throw err;
    }
  }

  private write(file: string, value: unknown): Promise<void> {
    const run = async () => {
      await mkdir(this.dir, { recursive: true });
      const tmp = `${file}.${process.pid}.tmp`;
      await writeFile(tmp, JSON.stringify(value), 'utf8');
      await rename(tmp, file);
    };
    this.writeQueue = this.writeQueue.then(run, run);
    return this.writeQueue;
  }

  private async app(): Promise<AppData> {
    if (!this.data) this.data = { ...emptyData(), ...(await this.readJson<Partial<AppData>>(this.appFile, {})) };
    return this.data;
  }

  private async taxMap(): Promise<Map<string, TaxRecord>> {
    if (!this.tax) this.tax = new Map((await this.readJson<TaxRecord[]>(this.taxFile, [])).map((r) => [r.key, r]));
    return this.tax;
  }

  private async flush() {
    await this.write(this.appFile, await this.app());
  }

  async getSession(id: string): Promise<SessionRecord | null> {
    const s = (await this.app()).sessions[id];
    return s ? structuredClone(s) : null;
  }

  async findLatestSessionId(userId: string): Promise<string | null> {
    let latest: SessionRecord | null = null;
    for (const s of Object.values((await this.app()).sessions)) {
      if (s.userId === userId && (!latest || s.updatedAt > latest.updatedAt)) latest = s;
    }
    return latest?.id ?? null;
  }

  async saveSessionState(session: Omit<SessionRecord, 'messages'>): Promise<void> {
    const data = await this.app();
    data.sessions[session.id] = { ...structuredClone(session), messages: data.sessions[session.id]?.messages ?? [] };
    await this.flush();
  }

  async appendMessages(sessionId: string, messages: ChatMessage[]): Promise<void> {
    const s = (await this.app()).sessions[sessionId];
    if (!s) throw new Error(`session ${sessionId} not found`);
    s.messages.push(...structuredClone(messages));
    await this.flush();
  }

  async replaceMessages(sessionId: string, messages: ChatMessage[]): Promise<void> {
    const s = (await this.app()).sessions[sessionId];
    if (!s) throw new Error(`session ${sessionId} not found`);
    s.messages = structuredClone(messages);
    await this.flush();
  }

  async listTickets(): Promise<SupportTicket[]> {
    return structuredClone((await this.app()).tickets).sort((a, b) => b.createdAt - a.createdAt);
  }

  async listTicketsForSession(sessionId: string): Promise<SupportTicket[]> {
    return (await this.listTickets()).filter((t) => t.sessionId === sessionId);
  }

  async getTicket(id: string): Promise<SupportTicket | null> {
    const t = (await this.app()).tickets.find((x) => x.id === id);
    return t ? structuredClone(t) : null;
  }

  async saveTicket(ticket: SupportTicket): Promise<void> {
    const data = await this.app();
    const idx = data.tickets.findIndex((t) => t.id === ticket.id);
    if (idx >= 0) data.tickets[idx] = structuredClone(ticket);
    else data.tickets.unshift(structuredClone(ticket));
    await this.flush();
  }

  async getRules(): Promise<Rules | null> {
    const r = (await this.app()).rules;
    return r ? structuredClone(r) : null;
  }

  async saveRules(rules: Rules | null): Promise<void> {
    (await this.app()).rules = rules ? structuredClone(rules) : null;
    await this.flush();
  }

  async saveTaxRecords(records: TaxRecord[]): Promise<void> {
    const map = await this.taxMap();
    for (const r of records) map.set(r.key, r);
    await this.write(this.taxFile, [...map.values()]);
  }

  async getTaxRecord(key: string): Promise<VehicleLookupResult | null> {
    const r = (await this.taxMap()).get(key);
    return r ? toLookupResult(r) : null;
  }

  async countTaxRecords(): Promise<number> {
    return (await this.taxMap()).size;
  }

  // Users live in Supabase Auth only: the file store has none (login needs Supabase)
  async getUserRole(_userId: string): Promise<UserRole | null> {
    return null;
  }

  async clearTaxRecords(): Promise<void> {
    (await this.taxMap()).clear();
    await this.write(this.taxFile, []);
  }
}
