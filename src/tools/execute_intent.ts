import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawClient, OneClawApiError } from "../client.js";

/**
 * Generic execution-intent tool for non-HTTP binding types (e.g. graphql).
 * For plain HTTP, prefer `execute_http`. The binding's credential is injected
 * server-side — the agent never sees it.
 */
export function executeIntentTool(client: OneClawClient) {
  return {
    name: "execute_intent" as const,
    description:
      "Execute an intent through a pre-configured binding of any type (e.g. 'graphql'). Pass intent_type and params (for graphql: { query, variables }). The credential is injected server-side. Requires execution_intents_enabled on the agent.",
    parameters: z.object({
      binding: z.string().describe("Name of the binding to use"),
      intent_type: z
        .string()
        .default("http")
        .describe("Intent type matching the binding (e.g. 'http', 'graphql')"),
      params: z
        .record(z.unknown())
        .default({})
        .describe("Executor params (e.g. { query, variables } for graphql, or { method, path, headers, body } for http)"),
      execution_mode: z
        .enum(["vault", "tee"])
        .default("vault")
        .describe("Execution surface: 'vault' (standard) or 'tee' (Shroud TEE, Business+ only)"),
    }),
    execute: async (args: {
      binding: string;
      intent_type?: string;
      params?: Record<string, unknown>;
      execution_mode?: string;
    }) => {
      try {
        const agentId = client.agentId;
        if (!agentId) {
          throw new UserError("Agent ID not resolved. Ensure ONECLAW_AGENT_API_KEY is set.");
        }
        const res = await client.executeIntent(agentId, {
          binding: args.binding,
          intent_type: args.intent_type ?? "http",
          execution_mode: args.execution_mode ?? "vault",
          params: args.params ?? {},
        });
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
