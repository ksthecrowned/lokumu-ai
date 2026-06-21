import { readdirSync, readFileSync } from "fs";
import path from "path";

export function searchInProject(query: string, dir: string) {
  const results: any[] = [];

  function walk(currentPath: string) {
    const files = readdirSync(currentPath);

    for (const file of files) {
      const fullPath = path.join(currentPath, file);

      try {
        const stat = require("fs").statSync(fullPath);

        if (stat.isDirectory()) {
          walk(fullPath);
        } else {
          const content = readFileSync(fullPath, "utf-8");

          if (content.includes(query)) {
            results.push({
              file: fullPath,
              match: true
            });
          }
        }
      } catch { }
    }
  }

  walk(dir);

  return results;
}
