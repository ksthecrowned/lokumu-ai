import { getGitStatus, GitStatus } from './status';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { execSync } from 'child_process';

describe('tools/git/status', () => {
  test('returns git status with required fields', async () => {
    // Create a temp git repo
    const testDir = join(tmpdir(), 'lokumu-git-test-' + Date.now());
    mkdirSync(testDir, { recursive: true });

    try {
      execSync('git init', { cwd: testDir, stdio: 'ignore' });
      execSync('git config user.email "test@test.com"', { cwd: testDir, stdio: 'ignore' });
      execSync('git config user.name "Test"', { cwd: testDir, stdio: 'ignore' });

      const status: GitStatus = await getGitStatus(testDir);

      expect(status).toHaveProperty('branch');
      expect(status).toHaveProperty('modified');
      expect(status).toHaveProperty('staged');
      expect(status).toHaveProperty('untracked');

      expect(Array.isArray(status.modified)).toBe(true);
      expect(Array.isArray(status.staged)).toBe(true);
      expect(Array.isArray(status.untracked)).toBe(true);
    } finally {
      rmSync(testDir, { recursive: true, force: true });
    }
  }, 10000);

  test('returns empty arrays for clean git status', async () => {
    // Create a temp git repo
    const testDir = join(tmpdir(), 'lokumu-git-test2-' + Date.now());
    mkdirSync(testDir, { recursive: true });

    try {
      execSync('git init', { cwd: testDir, stdio: 'ignore' });
      execSync('git config user.email "test@test.com"', { cwd: testDir, stdio: 'ignore' });
      execSync('git config user.name "Test"', { cwd: testDir, stdio: 'ignore' });

      const status = await getGitStatus(testDir);
      expect(status.branch).toBe('master'); // or main
      expect(status.untracked).toHaveLength(0);
    } finally {
      rmSync(testDir, { recursive: true, force: true });
    }
  }, 10000);
});