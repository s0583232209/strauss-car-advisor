/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FileRepository } from './fileRepository.ts';
import { SupabaseAuthGateway } from './supabaseAuth.ts';
import { SupabaseRepository } from './supabaseRepository.ts';
import { AuthGateway, Repository } from './types.ts';

export type { AuthGateway, AuthTokens, CreateUserAttempt, Repository, SessionRecord, TaxRecord } from './types.ts';

/** Supabase Auth when Supabase is configured; null = no login (development with the file store) */
export function createAuthGateway(env: { supabaseUrl?: string; supabaseServiceKey?: string }): AuthGateway | null {
  if (!env.supabaseUrl || !env.supabaseServiceKey) return null;
  return new SupabaseAuthGateway(env.supabaseUrl.replace(/\/+$/, ''), env.supabaseServiceKey);
}

/** Supabase when both server variables are set, otherwise local JSON files */
export function createRepository(env: { supabaseUrl?: string; supabaseServiceKey?: string; dataDir: string }): Repository {
  if (env.supabaseUrl && env.supabaseServiceKey) {
    return new SupabaseRepository(env.supabaseUrl.replace(/\/+$/, ''), env.supabaseServiceKey);
  }
  return new FileRepository(env.dataDir);
}
