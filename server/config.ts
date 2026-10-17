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
  supabaseUrl?: string;
  supabaseServiceKey?: string;
  dataDir: string;
  staticDir: string;
  /** Bearer tokens for the rep and admin APIs; unset = open (development only) */
  repAccessToken?: string;
  adminAccessToken?: string;
}

export class ConfigError extends Error {}

const list = (v: string | undefined) => (v ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const MIN_TOKEN_LENGTH = 16;

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
    dataDir: path.resolve(env.DATA_DIR || '.data'),
    staticDir: path.resolve(env.STATIC_DIR || 'dist'),
    repAccessToken: env.REP_ACCESS_TOKEN || undefined,
    adminAccessToken: env.ADMIN_ACCESS_TOKEN || undefined,
  };

  if (!config.gemini.apiKey) (isProduction ? errors : warnings).push('GEMINI_API_KEY is not set: the agent cannot answer');
  if (Boolean(config.supabaseUrl) !== Boolean(config.supabaseServiceKey)) {
    errors.push('Set both SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, or neither');
  }
  if (!config.supabaseUrl) {
    warnings.push(`No Supabase: data is kept in local files under ${config.dataDir} (single instance, needs a persistent disk)`);
  }

  for (const [name, token] of [['REP_ACCESS_TOKEN', config.repAccessToken], ['ADMIN_ACCESS_TOKEN', config.adminAccessToken]] as const) {
    if (!token) {
      if (isProduction) errors.push(`${name} is required in production (protects employee salary data)`);
      else warnings.push(`${name} is not set: that API is open (development only)`);
    } else if (token.length < MIN_TOKEN_LENGTH) {
      errors.push(`${name} must be at least ${MIN_TOKEN_LENGTH} characters`);
    }
  }

  // Old client-side names: Vite would put these into the browser bundle if any client code read them
  for (const legacy of ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_FALLBACK_KEY', 'VITE_FALLBACK_BASE_URL', 'VITE_FALLBACK_MODEL']) {
    if (env[legacy]) warnings.push(`${legacy} is no longer used: move it to the server variable (see .env.example) and delete it`);
  }

  if (errors.length) throw new ConfigError(`Invalid server configuration:\n- ${errors.join('\n- ')}`);
  return { config, warnings };
}
