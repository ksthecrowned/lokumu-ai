import { writeFile } from './fs/writeFile';
import { readFile } from './fs/readFile';
import { watchFiles } from './shell/watch';
import { getGitStatus } from './git/status';
import { searchCode } from './search/code';

export const TOOL_REGISTRY: Record<string, Function> = {
  write_file: writeFile,
  read_file: readFile,
  shell_watch: watchFiles,
  git_status: getGitStatus,
  search_code: searchCode,
};

export type ToolName = keyof typeof TOOL_REGISTRY;
export const TOOLS_LIST = Object.keys(TOOL_REGISTRY);