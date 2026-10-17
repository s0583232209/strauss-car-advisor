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
  CalibrationSummary,
  ChatStreamEvent,
  EmployeeProfile,
  ExtractedPayslipData,
  Rules,
  SampleEmployee,
  SessionState,
  SupportTicket,
  VehicleLookupResult,
} from '../../shared/types.ts';

export type Role = 'rep' | 'admin';

export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

// Per-browser conveniences: a lost value only means a new conversation or typing the code again
const SESSION_KEY = 'yoetz_session_id';
const tokenKey = (role: Role) => `yoetz_${role}_token`;

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

export const accessToken = {
  get: (role: Role) => storageGet(() => sessionStorage, tokenKey(role)),
  set: (role: Role, token: string | null) => storageSet(() => sessionStorage, tokenKey(role), token),
};

async function request<T>(
  method: string,
  path: string,
  options: { body?: unknown; role?: Role; raw?: BodyInit; contentType?: string } = {}
): Promise<T> {
  const headers: Record<string, string> = {};
  const token = options.role ? accessToken.get(options.role) : null;
  if (token) headers.Authorization = `Bearer ${token}`;
  let body: BodyInit | undefined;
  if (options.raw !== undefined) {
    body = options.raw;
    headers['Content-Type'] = options.contentType ?? 'application/octet-stream';
  } else if (options.body !== undefined) {
    body = JSON.stringify(options.body);
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`/api${path}`, { method, headers, body });
  if (!res.ok) {
    let message = `שגיאת שרת (${res.status})`;
    try {
      message = (await res.json()).error || message;
    } catch {
      // Not JSON
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  meta: () => request<{ sampleEmployees: SampleEmployee[]; rules: Rules }>('GET', '/meta'),

  sessions: {
    /** This browser's conversation, or a new one when there is none (or it no longer exists) */
    async current(): Promise<SessionState> {
      const id = storageGet(() => localStorage, SESSION_KEY);
      if (id) {
        try {
          return await request<SessionState>('GET', `/sessions/${id}`);
        } catch (err) {
          if (!(err instanceof ApiError) || (err.status !== 404 && err.status !== 400)) throw err;
        }
      }
      const created = await request<SessionState>('POST', '/sessions');
      storageSet(() => localStorage, SESSION_KEY, created.id);
      return created;
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
      const res = await fetch(`/api/sessions/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, repParticipationMode }),
      });
      if (!res.ok || !res.body) {
        let message = `שגיאת שרת (${res.status})`;
        try {
          message = (await res.json()).error || message;
        } catch {
          // Not JSON
        }
        throw new ApiError(res.status, message);
      }

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
    list: () => request<SupportTicket[]>('GET', '/tickets', { role: 'rep' }),
    answer: (id: string, answer: { status: 'answered' | 'closed'; text?: string; value?: number; effectiveFrom?: string }) =>
      request<SupportTicket>('POST', `/tickets/${id}/answer`, { body: answer, role: 'rep' }),
  },

  admin: {
    overview: () => request<AdminOverview>('GET', '/admin/overview', { role: 'admin' }),
    saveRules: (rules: unknown) => request<Rules>('PUT', '/admin/rules', { body: { rules }, role: 'admin' }),
    resetRules: () => request<Rules>('POST', '/admin/rules/reset', { role: 'admin' }),
    runCalibration: () => request<CalibrationSummary>('POST', '/admin/calibration', { role: 'admin' }),
    uploadTaxCsv: (file: File) =>
      request<{ count: number }>('POST', '/admin/tax-records', { raw: file, contentType: 'text/csv', role: 'admin' }),
    clearTaxRecords: () => request<void>('DELETE', '/admin/tax-records', { role: 'admin' }),
    lookup: async (q: { year: string; type: string; product: string; model: string }) =>
      (await request<{ result: VehicleLookupResult | null }>('GET', `/admin/tax-records/lookup?${new URLSearchParams(q)}`, { role: 'admin' })).result,
  },

  payslip: {
    extract: (fileData: string, mimeType: string) =>
      request<ExtractedPayslipData>('POST', '/payslip/extract', { body: { fileData, mimeType } }),
  },
};
