import { TOOL_REGISTRY } from "../tools/registry";

export async function runTool(call: any) {
  const toolFn = TOOL_REGISTRY[call.tool];

  if (!toolFn) {
    return {
      success: false,
      error: `UNKNOWN_TOOL: ${call.tool}`,
      allowed: Object.keys(TOOL_REGISTRY),
    };
  }

  return await toolFn(call.args);
}
