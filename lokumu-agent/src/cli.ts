import { LLM } from "./llm";
import { CodeAgent } from "./agent/agent";

async function main() {
  const llm = new LLM("http://localhost:11434/api/chat");

  const agent = new CodeAgent(llm);

  const result = await agent.run(
    "Create file tmp/test.txt with content hello lokumu using write_file tool"
  );

  console.log("\nFINAL RESULT:", result);
}

main().catch(console.error);
