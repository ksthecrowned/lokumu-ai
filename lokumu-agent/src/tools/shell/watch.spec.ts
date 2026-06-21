import { watchFiles } from './watch';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('shell/watch', () => {
  const testDir = join(tmpdir(), 'lokumu-watch-test-' + Date.now());

  beforeEach(() => {
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  test('watches file changes matching pattern', (done) => {
    const watcher = watchFiles(testDir, '\\.ts$', (event, path) => {
      // On Windows, file creation emits 'rename', on Unix 'change'
      expect(['change', 'rename']).toContain(event);
      expect(path).toContain('test.ts');
      watcher.close();
      done();
    });

    // Trigger change after small delay
    setTimeout(() => {
      writeFileSync(join(testDir, 'test.ts'), '// test');
    }, 100);
  }, 5000);

  test('returns closeable watcher', () => {
    const watcher = watchFiles(testDir, '\\.ts$', () => {});
    expect(watcher).toHaveProperty('close');
    expect(typeof watcher.close).toBe('function');
    watcher.close();
  });
});