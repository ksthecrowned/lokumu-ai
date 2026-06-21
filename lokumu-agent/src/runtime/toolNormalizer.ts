// src/runtime/toolNormalizer.ts

export type ToolCall = {
  tool: string;
  args: Record<string, any>;
};

function normalizeArgs(args: any): Record<string, any> {
  if (!args || typeof args !== "object") {
    return {};
  }

  // normalisation path universelle
  const path =
    args.path ??
    args.file_path ??
    args.fileName ??
    args.file_name;

  const content = args.content ?? args.data;

  const normalized: Record<string, any> = {
    ...args,
  };

  if (path) normalized.path = path;
  if (content !== undefined) normalized.content = content;

  // cleanup des alias cassés
  delete normalized.file_path;
  delete normalized.fileName;
  delete normalized.file_name;
  delete normalized.data;

  return normalized;
}

export function normalizeToolCall(raw: any) {
  const tool = raw?.tool;

  let args = raw?.args ?? {};

  // 🧠 NORMALISATION WRITE_FILE
  if (tool === "write_file") {
    return {
      tool,
      args: {
        path:
          args.path ??
          args.file_path ??
          args.file ??
          args.fileName ??
          args.filename,

        content:
          args.content ??
          args.contents ??
          args.text ??
          "",
      },
    };
  }

  // fallback générique
  return { tool, args };
}
