/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FileRepository } from './fileRepository.ts';
import { SupabaseRepository } from './supabaseRepository.ts';
import { Repository } from './types.ts';

export type { Repository, SessionRecord, TaxRecord } from './types.ts';

/** Supabase when both server variables are set, otherwise local JSON files */
export function createRepository(env: { supabaseUrl?: string; supabaseServiceKey?: string; dataDir: string }): Repository {
  if (env.supabaseUrl && env.supabaseServiceKey) {
    return new SupabaseRepository(env.supabaseUrl.replace(/\/+$/, ''), env.supabaseServiceKey);
  }
  return new FileRepository(env.dataDir);
}
