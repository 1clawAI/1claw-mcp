import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawClient, OneClawApiError } from "../client.js";

/**
 * Create a binding for the current agent. Human-gated: the backend rejects
 * agent-authenticated callers (a human operator configures bindings). The
 * credential is stored server-side and never returned.
 */
export function createBindingTool(client: OneClawClient) {
  return {
    name: "create_binding" as const,
    description:
      "Create a binding (credential handle) for the current agent. Requires a human operator token — agents cannot create their own bindings. The credential is stored server-side and never returned.",
    parameters: z.object({
      name: z.string().describe("Binding name (alphanumeric, '-', '_'; 1-64 chars)"),
      binding_type: z
        .string()
        .default("http")
        .describe("Binding type: http, graphql, postgres, redis, smtp, s3, custom, ..."),
      config: z
        .record(z.unknown())
        .default({})
        .describe("Binding config (e.g. { base_url, auth_type, auth_header })"),
      guardrails: z
        .record(z.unknown())
        .optional()
        .describe("Optional guardrails (allowed_hosts, max_duration_ms, max_requests_per_minute)"),
      credential: z
        .record(z.unknown())
        .optional()
        .describe("Credential material (e.g. { token } or { value }). Stored server-side."),
    }),
    execute: async (args: {
      name: string;
      binding_type?: string;
      config?: Record<string, unknown>;
      guardrails?: Record<string, unknown>;
      credential?: Record<string, unknown>;
    }) => {
      try {
        const agentId = client.agentId;
        if (!agentId) {
          throw new UserError("Agent ID not resolved. Ensure ONECLAW_AGENT_API_KEY is set.");
        }
        const res = await client.createBinding(agentId, {
          name: args.name,
          binding_type: args.binding_type ?? "http",
          config: args.config ?? {},
          guardrails: args.guardrails,
          credential: args.credential,
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
