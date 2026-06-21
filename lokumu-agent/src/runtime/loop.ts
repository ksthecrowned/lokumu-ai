import { parseToolCall } from "./toolProtocol";
import { normalizeToolCall } from "./toolNormalizer";
import { runTool } from "./toolRunner";

export async function runAgentLoop(agent: any, task: string, maxSteps = 8) {
  let context = task;

  for (let step = 0; step < maxSteps; step++) {
    const raw = await agent.askLLM([
      { role: "system", content: agent.systemPrompt },
      { role: "user", content: context },
    ]);

    console.log("\n🧠 STEP", step);
    console.log(raw);

    let parsed;

    try {
      parsed = parseToolCall(raw);
    } catch {
      context = `ONLY OUTPUT JSON TOOL CALL`;
      continue;
    }

    // 🧠 IMPORTANT : NORMALISATION ICI
    const toolCall = normalizeToolCall(parsed);

    if (toolCall.tool === "done") {
      return "DONE";
    }

    const result = await runTool(toolCall);

    // 🧠 IMPORTANT: si tool inconnu → feedback immédiat
    if ((result as any)?.error?.startsWith?.("UNKNOWN_TOOL")) {
      context = `
      You used an invalid tool.

      ALLOWED TOOLS:
      ${JSON.stringify(agent.toolsList)}

      RULE:
      - You MUST only use allowed tools
      - No python, no execute, no shell
      - Only write_file

      Return valid JSON only.
      `;
      continue;
    }
  }

  return "DONE";
}
