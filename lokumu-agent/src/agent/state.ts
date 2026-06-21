export type AgentState = {
  task: string;
  steps: Array<{
    tool: string;
    args: any;
    result?: any;
  }>;
  lastResult?: any;
};
