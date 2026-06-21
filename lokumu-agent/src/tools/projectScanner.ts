import fs from "fs";
import path from "path";

export function scanProject(dir: string) {
  return fs.readdirSync(dir).map(file => ({
    file,
    path: path.join(dir, file)
  }));
}
