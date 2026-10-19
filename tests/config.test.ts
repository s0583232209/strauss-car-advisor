import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from '../server/config.ts';

const prod = {
  NODE_ENV: 'production',
  GEMINI_API_KEY: 'k',
  SUPABASE_URL: 'https://x.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 's',
};

describe('server configuration', () => {
  it('production refuses to start without Supabase (login) or the model key', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(ConfigError);
    expect(() => loadConfig({ ...prod, SUPABASE_URL: undefined, SUPABASE_SERVICE_ROLE_KEY: undefined })).toThrow(/SUPABASE_URL/);
    expect(() => loadConfig({ ...prod, GEMINI_API_KEY: undefined })).toThrow(/GEMINI_API_KEY/);
  });

  it('the old shared access codes only produce a warning', () => {
    const { warnings } = loadConfig({ ...prod, ADMIN_ACCESS_TOKEN: 'short' });
    expect(warnings.join('\n')).toMatch(/ADMIN_ACCESS_TOKEN is no longer used/);
  });

  it('Supabase needs both the URL and the service key', () => {
    expect(() => loadConfig({ ...prod, SUPABASE_SERVICE_ROLE_KEY: undefined })).toThrow(/SUPABASE/);
    const { config } = loadConfig(prod);
    expect(config.supabaseServiceKey).toBe('s');
  });

  it('production listens on all interfaces; development on localhost only', () => {
    expect(loadConfig(prod).config.host).toBe('0.0.0.0');
    expect(loadConfig({}).config.host).toBe('127.0.0.1');
  });

  it('development starts without secrets but warns, also about old VITE_ secrets', () => {
    const { warnings } = loadConfig({ VITE_SUPABASE_ANON_KEY: 'x' });
    expect(warnings.join('\n')).toMatch(/GEMINI_API_KEY/);
    expect(warnings.join('\n')).toMatch(/VITE_SUPABASE_ANON_KEY/);
  });
});
