/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The client's only way to the server. The UI never imports the engine, the agent or storage:
 * every calculation and every saved value goes through these calls.
 */

import type {
  AdminOverview,
  AuthStatus,
  AuthUser,
  ChatStreamEvent,
  DataFilePreview,
  DataTableKind,
  EmployeeProfile,
  ExtractedPayslipData,
  Rules,
  RulesPreview,
  SampleEmployee,
  SessionState,
  SupportTicket,
  UserRole,
  VehicleLookupResult,
} from '../../shared/types.ts';

export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// Per-browser convenience: a lost value only means the server looks up the user's last conversation
const SESSION_KEY = 'yoetz_session_id';

function storageGet(store: () => Storage, key: string): string | null {
  try {
    return store().getItem(key);
  } catch {
    return null;
  }
}
function storageSet(store: () => Storage, key: string, value: string | null): void {
  try {
    if (value === null) store().removeItem(key);
    else store().setItem(key, value);
  } catch {
    // Storage blocked (private window): keep working without it
  }
}

/*
 * Login lives in httpOnly cookies that this code never sees. The access cookie is short-lived; when
 * a call gets 401, GET /api/auth/me renews it with the refresh cookie and the call is sent once more.
 * If that fails too, the app is told to show the login screen.
 */
let onLoggedOut: () => void = () => undefined;
export function setLoggedOutHandler(handler: () => void): void {
  onLoggedOut = handler;
}

let renewing: Promise<boolean> | null = null;
function renewLogin(): Promise<boolean> {
  renewing ??= fetch('/api/auth/me')
    .then(async (res) => res.ok && Boolean(((await res.json()) as AuthStatus).user))
    .catch(() => false)
    .finally(() => {
      renewing = null;
    });
  return renewing;
}

async function fetchWithLogin(url: string, init: RequestInit): Promise<Response> {
  const res = await fetch(url, init);
  if (res.status !== 401 || url.startsWith('/api/auth/')) return res;
  if (await renewLogin()) {
    const retry = await fetch(url, init);
    if (retry.status !== 401) return retry;
  }
  onLoggedOut();
  return res;
}

async function errorFrom(res: Response): Promise<ApiError> {
  let message = `שגיאת שרת (${res.status})`;
  try {
    message = (await res.json()).error || message;
  } catch {
    // Not JSON
  }
  return new ApiError(res.status, message);
}

async function request<T>(
  method: string,
  path: string,
  options: { body?: unknown; raw?: BodyInit; contentType?: string } = {}
): Promise<T> {
  const headers: Record<string, string> = {};
  let body: BodyInit | undefined;
  if (options.raw !== undefined) {
    body = options.raw;
    headers['Content-Type'] = options.contentType ?? 'application/octet-stream';
  } else if (options.body !== undefined) {
    body = JSON.stringify(options.body);
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetchWithLogin(`/api${path}`, { method, headers, body });
  if (!res.ok) throw await errorFrom(res);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  auth: {
    /** enabled = false: the server has no login (development), every screen is open */
    me: () => request<AuthStatus>('GET', '/auth/me'),
    login: (email: string, password: string) => request<AuthUser>('POST', '/auth/login', { body: { email, password } }),
    async logout(): Promise<void> {
      // The conversation belongs to the user who leaves; the next user finds theirs on the server
      storageSet(() => localStorage, SESSION_KEY, null);
      await request<void>('POST', '/auth/logout');
    },
  },

  meta: () => request<{ sampleEmployees: SampleEmployee[]; rules: Rules }>('GET', '/meta'),

  sessions: {
    /**
     * This browser's conversation; else the user's latest one (from any device); else a new one.
     * The server answers 404 for a conversation that belongs to someone else.
     */
    async current(): Promise<SessionState> {
      const notFound = (err: unknown) => err instanceof ApiError && (err.status === 404 || err.status === 400);
      const id = storageGet(() => localStorage, SESSION_KEY);
      if (id) {
        try {
          return await request<SessionState>('GET', `/sessions/${id}`);
        } catch (err) {
          if (!notFound(err)) throw err;
        }
      }
      let session: SessionState;
      try {
        session = await request<SessionState>('GET', '/sessions/mine');
      } catch (err) {
        if (!notFound(err)) throw err;
        session = await request<SessionState>('POST', '/sessions');
      }
      storageSet(() => localStorage, SESSION_KEY, session.id);
      return session;
    },
    reset: (id: string) => request<SessionState>('POST', `/sessions/${id}/reset`),
    loadSample: (id: string, employeeId: string) => request<SessionState>('POST', `/sessions/${id}/sample`, { body: { employeeId } }),
    updateProfile: (id: string, updates: Partial<Record<keyof EmployeeProfile, unknown>>, source: 'manual' | 'payslip') =>
      request<SessionState>('PATCH', `/sessions/${id}/profile`, { body: { updates, source } }),
    askRep: (id: string) => request<SessionState>('POST', `/sessions/${id}/tickets`),
    sync: (id: string, repParticipationMode: boolean) =>
      request<SessionState>('POST', `/sessions/${id}/sync`, { body: { repParticipationMode } }),

    /** One agent turn; onEvent gets the status lines while the agent works. Resolves with the session. */
    async sendMessage(
      id: string,
      text: string,
      repParticipationMode: boolean,
      onEvent: (event: ChatStreamEvent) => void
    ): Promise<SessionState> {
      const res = await fetchWithLogin(`/api/sessions/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, repParticipationMode }),
      });
      if (!res.ok || !res.body) throw await errorFrom(res);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let result: SessionState | null = null;
      for (;;) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        let nl: number;
        while ((nl = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          const event = JSON.parse(line) as ChatStreamEvent;
          if (event.type === 'result') result = event.session;
          else if (event.type === 'error') throw new ApiError(500, event.message);
          else onEvent(event);
        }
        if (done) break;
      }
      if (!result) throw new ApiError(500, 'התשובה מהשרת נקטעה. אנא נסו שנית.');
      return result;
    },
  },

  tickets: {
    openCount: async () => (await request<{ open: number }>('GET', '/tickets/summary')).open,
    list: () => request<SupportTicket[]>('GET', '/tickets'),
    answer: (id: string, answer: { status: 'answered' | 'closed'; text?: string; value?: number; effectiveFrom?: string }) =>
      request<SupportTicket>('POST', `/tickets/${id}/answer`, { body: answer }),
  },

  admin: {
    overview: () => request<AdminOverview>('GET', '/admin/overview'),
    saveRules: (rules: unknown) => request<Rules>('PUT', '/admin/rules', { body: { rules } }),
    resetRules: () => request<Rules>('POST', '/admin/rules/reset'),
    previewRules: (rules: unknown) => request<RulesPreview>('POST', '/admin/rules/preview', { body: { rules } }),
    /** The data workbook (.xlsx): preview changes nothing; apply replaces every table found in it */
    previewDataFile: (file: File) => request<DataFilePreview>('POST', '/admin/data/preview', { raw: file, contentType: XLSX_TYPE }),
    applyDataFile: (file: File) => request<DataFilePreview>('POST', '/admin/data/apply', { raw: file, contentType: XLSX_TYPE }),
    resetDataTable: (table: DataTableKind) => request<void>('DELETE', `/admin/data/${table}`),
    uploadTaxCsv: (file: File) =>
      request<{ count: number }>('POST', '/admin/tax-records', { raw: file, contentType: 'text/csv' }),
    clearTaxRecords: () => request<void>('DELETE', '/admin/tax-records'),
    createUser: (user: { email: string; password: string; role: UserRole }) =>
      request<AuthUser>('POST', '/admin/users', { body: user }),
    lookup: async (q: { year: string; type: string; product: string; model: string }) =>
      (await request<{ result: VehicleLookupResult | null }>('GET', `/admin/tax-records/lookup?${new URLSearchParams(q)}`)).result,
  },

  payslip: {
    extract: (fileData: string, mimeType: string) =>
      request<ExtractedPayslipData>('POST', '/payslip/extract', { body: { fileData, mimeType } }),
  },
};
