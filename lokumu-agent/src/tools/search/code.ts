import { Glob } from 'bun';
import { join, normalize } from 'path';

export interface SearchResult {
  file: string;
  matches: string[];
}

export async function searchCode(
  pattern: string,
  directory: string = '.',
  filePatterns: string[] = ['**/*.ts', '**/*.js', '**/*.tsx', '**/*.jsx'],
): Promise<SearchResult[]> {
  const regex = new RegExp(pattern, 'gi');
  const results: SearchResult[] = [];
  const absoluteDir = normalize(directory);

  for (const filePattern of filePatterns) {
    const glob = new Glob(filePattern);
    for await (const file of glob.scan(absoluteDir)) {
      try {
        const filePath = normalize(join(absoluteDir, file));
        const text = await Bun.file(filePath).text();
        const matches: string[] = [];
        const lines = text.split('\n');

        for (let i = 0; i < lines.length; i++) {
          if (regex.test(lines[i])) {
            matches.push(`Line ${i + 1}: ${lines[i].trim()}`);
          }
        }

        if (matches.length > 0) {
          results.push({
            file,
            matches,
          });
        }
      } catch {
        // Skip unreadable files
      }
    }
  }

  return results;
}