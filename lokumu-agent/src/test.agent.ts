import { CodeAgent } from "./agent/agent";
import { LLM } from "./llm";

import { writeFile } from "./tools/fs/writeFile";

async function main() {
  const llm = new LLM("http://localhost:11434/api/chat");

  const agent = new CodeAgent(llm, {
    write_file: writeFile,
  });

  const result = await agent.run(
    "Create file tmp/test.txt with content hello lokumu using write_file tool"
  );

  console.log("FINAL RESULT:", result);
}

main().catch(console.error);
