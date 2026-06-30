import 'dotenv/config';
import { exportApprovedDialogues } from './hf-training/export-jsonl';

async function main() {
  const result = await exportApprovedDialogues();
  console.log(`Exported ${result.count} dialogues to ${result.path}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
