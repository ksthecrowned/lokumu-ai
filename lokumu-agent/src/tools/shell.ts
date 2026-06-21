import { exec } from "child_process";

const ALLOWED_COMMANDS = ["ls", "cat", "echo", "pwd", "npm", "bun"];

export function runShell(command: string) {
  const baseCommand = command.split(" ")[0];

  if (!baseCommand || !ALLOWED_COMMANDS.includes(baseCommand)) {
    throw new Error(`Command not allowed: ${baseCommand}`);
  }

  return new Promise((resolve, reject) => {
    exec(command, (err, stdout, stderr) => {
      if (err) return reject(stderr);
      resolve(stdout);
    });
  });
}
