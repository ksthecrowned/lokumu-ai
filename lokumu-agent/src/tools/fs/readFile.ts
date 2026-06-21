import fs from "fs/promises";

export async function readFile(args: any) {
  if (typeof args?.path !== "string") {
    throw new Error("Invalid path");
  }

  const content = await fs.readFile(args.path, "utf-8");

  return {
    path: args.path,
    content,
  };
}
