import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawClient, OneClawApiError } from "../client.js";

/** List recent execution events (audit/observability) for the current agent. */
export function listExecutionsTool(client: OneClawClient) {
  return {
    name: "list_executions" as const,
    description:
      "List recent execution-intent events for the current agent: status, intent_type, duration, cost, and redactions. Useful for auditing what the agent executed.",
    parameters: z.object({
      limit: z.number().int().min(1).max(100).default(50).describe("Max events to return"),
      offset: z.number().int().min(0).default(0).describe("Pagination offset"),
    }),
    execute: async (args: { limit?: number; offset?: number }) => {
      try {
        const agentId = client.agentId;
        if (!agentId) {
          throw new UserError("Agent ID not resolved. Ensure ONECLAW_AGENT_API_KEY is set.");
        }
        const res = await client.listExecutions(agentId, args.limit ?? 50, args.offset ?? 0);
        return JSON.stringify(res, null, 2);
      } catch (err) {
        if (err instanceof OneClawApiError) {
          throw new UserError(err.message);
        }
        throw err;
      }
    },
  };
}
