/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Server configuration: the only place that reads server environment variables (secrets).
 * Client code never sees these: Vite exposes only VITE_* variables, and the client uses none.
 */

import path from 'node:path';

export interface ServerConfig {
  isProduction: boolean;
  port: number;
  host: string;
  /** Express "trust proxy" (behind a cloud load balancer), for the real client IP in rate limits */
  trustProxy: string | number | boolean;
  /** Extra origins allowed by CORS; the app's own origin is always allowed */
  allowedOrigins: string[];
  gemini: { apiKey: string; models: string[]; modelTimeoutMs: number };
  fallback: { baseUrl: string; apiKey: string; model: string } | null;
  /** Agent debug trace on the server console: never in production; AGENT_DEBUG_LOG=off silences it in development */
  agentDebugLog: boolean;
  supabaseUrl?: string;
  supabaseServiceKey?: string;
  dataDir: string;
  staticDir: string;
}

export class ConfigError extends Error {}

const list = (v: string | undefined) => (v ?? '').split(',').map((s) => s.trim()).filter(Boolean);

function parseTrustProxy(v: string | undefined): string | number | boolean {
  if (v === undefined || v === '') return false;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return /^\d+$/.test(v) ? Number(v) : v;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): { config: ServerConfig; warnings: string[] } {
  const isProduction = env.NODE_ENV === 'production';
  const warnings: string[] = [];
  const errors: string[] = [];

  const config: ServerConfig = {
    isProduction,
    port: Number(env.PORT) || 3000,
    host: env.HOST || (isProduction ? '0.0.0.0' : '127.0.0.1'),
    trustProxy: parseTrustProxy(env.TRUST_PROXY),
    allowedOrigins: list(env.ALLOWED_ORIGINS),
    gemini: {
      apiKey: env.GEMINI_API_KEY || '',
      models: list(env.GEMINI_MODEL).length ? list(env.GEMINI_MODEL) : ['gemini-3.5-flash-lite'],
      modelTimeoutMs: Number(env.GEMINI_MODEL_TIMEOUT_MS) || 10000,
    },
    fallback:
      env.FALLBACK_BASE_URL && env.FALLBACK_API_KEY
        ? {
            baseUrl: env.FALLBACK_BASE_URL.replace(/\/+$/, ''),
            apiKey: env.FALLBACK_API_KEY,
            model: env.FALLBACK_MODEL || 'meta-llama/llama-3.3-70b-instruct',
          }
        : null,
    supabaseUrl: env.SUPABASE_URL || undefined,
    supabaseServiceKey: env.SUPABASE_SERVICE_ROLE_KEY || undefined,
    agentDebugLog: !isProduction && env.AGENT_DEBUG_LOG !== 'off',
    dataDir: path.resolve(env.DATA_DIR || '.data'),
    staticDir: path.resolve(env.STATIC_DIR || 'dist'),
  };

  if (!config.gemini.apiKey) (isProduction ? errors : warnings).push('GEMINI_API_KEY is not set: the agent cannot answer');
  if (Boolean(config.supabaseUrl) !== Boolean(config.supabaseServiceKey)) {
    errors.push('Set both SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, or neither');
  }
  if (!config.supabaseUrl) {
    // Login is Supabase Auth: without it every screen is open, which only development may allow
    if (isProduction) errors.push('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in production (login protects employee salary data)');
    else warnings.push(`No Supabase: no login, every screen is open, and data is kept in local files under ${config.dataDir} (development only)`);
  }

  // Shared access codes were replaced by user login (Supabase Auth)
  for (const legacy of ['REP_ACCESS_TOKEN', 'ADMIN_ACCESS_TOKEN']) {
    if (env[legacy]) warnings.push(`${legacy} is no longer used: users log in with Supabase Auth; delete it`);
  }

  // Old client-side names: Vite would put these into the browser bundle if any client code read them
  for (const legacy of ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_FALLBACK_KEY', 'VITE_FALLBACK_BASE_URL', 'VITE_FALLBACK_MODEL']) {
    if (env[legacy]) warnings.push(`${legacy} is no longer used: move it to the server variable (see .env.example) and delete it`);
  }

  if (errors.length) throw new ConfigError(`Invalid server configuration:\n- ${errors.join('\n- ')}`);
  return { config, warnings };
}
