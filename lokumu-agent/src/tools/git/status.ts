import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface GitStatus {
  modified: string[];
  staged: string[];
  untracked: string[];
  branch: string;
}

export async function getGitStatus(cwd: string): Promise<GitStatus> {
  const { stdout: branchOut } = await execAsync('git branch --show-current', { cwd });
  const { stdout: statusOut } = await execAsync('git status --porcelain', { cwd });

  const lines = statusOut.trim().split('\n').filter((l) => l);
  const modified: string[] = [];
  const staged: string[] = [];
  const untracked: string[] = [];

  for (const line of lines) {
    if (line.startsWith(' M') || line.startsWith('M ')) {
      modified.push(line.slice(3));
    } else if (line.startsWith('M ') && line[0] === 'M') {
      staged.push(line.slice(3));
    } else if (line.startsWith('A ')) {
      staged.push(line.slice(3));
    } else if (line.startsWith('??')) {
      untracked.push(line.slice(3));
    }
  }

  return {
    branch: branchOut.trim(),
    modified,
    staged,
    untracked,
  };
}