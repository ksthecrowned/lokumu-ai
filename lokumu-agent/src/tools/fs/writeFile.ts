import fs from "fs/promises";
import path from "path";

export async function writeFile(args: any) {
  const filePath =
    args?.path ??
    args?.file_path ??
    args?.file;

  if (typeof filePath !== "string") {
    throw new Error(`Invalid path: ${JSON.stringify(args)}`);
  }

  const content = String(args?.content ?? "");

  await fs.mkdir(path.dirname(filePath), { recursive: true });

  await fs.writeFile(filePath, content, "utf-8");

  return {
    success: true,
    path: filePath,
  };
}
