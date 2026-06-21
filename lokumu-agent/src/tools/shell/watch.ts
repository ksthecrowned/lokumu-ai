// Simple file watcher using fs.watch (Bun compatible)
export interface FileWatcher {
  close(): void;
}

export function watchFiles(
  dir: string,
  pattern: string,
  callback: (event: 'change' | 'rename', path: string) => void,
): FileWatcher {
  const fs = require('fs');
  const path = require('path');
  
  const watcher = fs.watch(dir, (event: string, filename: string) => {
    if (filename && new RegExp(pattern).test(filename)) {
      callback(event as 'change' | 'rename', path.join(dir, filename));
    }
  });

  return {
    close: () => watcher.close(),
  };
}