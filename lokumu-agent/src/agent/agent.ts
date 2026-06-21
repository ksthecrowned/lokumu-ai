import { TOOL_REGISTRY } from "../tools/registry";
import { runAgentLoop } from "../runtime/loop";

export class CodeAgent {
  public tools = TOOL_REGISTRY;

  constructor(private llm: any) { }

  systemPrompt = `
You are a strict tool execution engine.

ALLOWED TOOLS:
${Object.keys(TOOL_REGISTRY).join(", ")}

RULES:
- ONLY output JSON
- NEVER invent tools
`;

  async askLLM(messages: any[]) {
    return this.llm.ask(messages);
  }

  async run(task: string) {
    return runAgentLoop(this, task);
  }
}
