// Static job registry. Each entry binds an id, default cron, model tier,
// MCPs the handler will need, and the handler module.
//
// Schedules are local-time. Off-the-minute on purpose so we don't pile
// onto :00 / :30 with the rest of the world.
//
// This is a starter registry with two example jobs. Add your own handlers
// under ./handlers/ and register them here.

import { run as runSessionSummariser } from "./handlers/session-summariser.js";
import { runAgentJob } from "./handlers/agent.js";

export const JOBS = [
  {
    id: "session-summariser",
    title: "Session summariser (Layer 1 → Layer 2 promotion)",
    description: "Every 4h. Distills idle (>24h) chat sessions into structured journal entries and appends them to memory via memory_record. Closes the gap where the in-line auto-recorder misses session-level context.",
    defaultCron: "17 */4 * * *",
    model: "haiku",
    mcps: [],   // memory MCP is Tier 1, always running
    handler: runSessionSummariser,
  },
  {
    id: "agent-task",
    title: "Scheduled agent task",
    description: "Runs a full agent turn on a schedule with a user-defined prompt. Configure via the dynamic-jobs API. Useful for recurring digests, checks, or reports.",
    defaultCron: "0 9 * * 1-5",         // 09:00 weekdays
    model: "sonnet",
    mcps: [],
    handler: runAgentJob,
  },
];

export function getJob(id) {
  return JOBS.find((j) => j.id === id) || null;
}
