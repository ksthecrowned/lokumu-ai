import { searchCode, SearchResult } from './code';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('tools/search/code', () => {
  const testDir = join(tmpdir(), 'lokumu-search-test-' + Date.now());

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
    writeFileSync(join(testDir, 'test1.ts'), 'function hello() {\n  return "world";\n}\nconst x = "hello";');
    writeFileSync(join(testDir, 'test2.ts'), 'function world() {\n  return "earth";\n}');
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  test('searches files matching pattern', async () => {
    const results: SearchResult[] = await searchCode('hello', testDir);

    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty('file');
    expect(results[0]).toHaveProperty('matches');
  });

  test('returns matches in correct format', async () => {
    const results: SearchResult[] = await searchCode('function', testDir);

    expect(results.length).toBe(2);
    for (const r of results) {
      expect(r.matches.some((m) => m.includes('function'))).toBe(true);
    }
  });

  test('returns empty for no matches', async () => {
    const results: SearchResult[] = await searchCode('zzzznonexistentzzz', testDir);
    expect(results).toHaveLength(0);
  });
});