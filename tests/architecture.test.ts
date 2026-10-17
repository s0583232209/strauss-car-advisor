import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/** Every .ts/.tsx file under a folder */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

/** Import targets of a file, resolved to paths relative to the project root */
function importsOf(file: string): string[] {
  const text = readFileSync(file, 'utf8');
  const specs = [...text.matchAll(/(?:import|export)[^'"]*?from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g)].map(
    (m) => m[1] ?? m[2]
  );
  return specs
    .filter((s) => s.startsWith('.'))
    .map((s) => path.relative(process.cwd(), path.resolve(path.dirname(file), s)).replace(/\\/g, '/'));
}

describe('3-tier boundaries', () => {
  it('the client (src/) imports only itself and shared/, never the server tiers or data files', () => {
    const offenders = sourceFiles('src').flatMap((f) =>
      importsOf(f)
        .filter((target) => !target.startsWith('src/') && !target.startsWith('shared/'))
        .map((target) => `${f} → ${target}`)
    );
    expect(offenders).toEqual([]);
  });

  it('shared/ holds types only and imports nothing from the tiers', () => {
    for (const f of sourceFiles('shared')) {
      expect(importsOf(f).filter((t) => !t.startsWith('shared/'))).toEqual([]);
      // No runtime code: only type/interface declarations and comments
      expect(readFileSync(f, 'utf8')).not.toMatch(/^\s*export\s+(const|function|class|let|var)\s/m);
    }
  });

  it('the server never imports client code', () => {
    const offenders = sourceFiles('server').flatMap((f) =>
      importsOf(f).filter((t) => t.startsWith('src/')).map((t) => `${f} → ${t}`)
    );
    expect(offenders).toEqual([]);
  });

  it('business logic does not reach into the API layer, and the DAL does not reach into the BL or API', () => {
    const bl = sourceFiles('server/bl').flatMap((f) => importsOf(f).filter((t) => t.startsWith('server/api/')).map((t) => `${f} → ${t}`));
    const dal = sourceFiles('server/dal').flatMap((f) =>
      importsOf(f).filter((t) => t.startsWith('server/api/') || t.startsWith('server/bl/')).map((t) => `${f} → ${t}`)
    );
    expect([...bl, ...dal]).toEqual([]);
  });

  it('the client never reads server secrets or VITE_ secrets', () => {
    for (const f of sourceFiles('src')) {
      const text = readFileSync(f, 'utf8');
      expect(text, f).not.toMatch(/import\.meta\.env\.VITE_|process\.env|SERVICE_ROLE|GEMINI_API_KEY/);
    }
  });
});
