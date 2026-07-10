import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawClient, OneClawApiError } from "../client.js";

export function executeHttpTool(client: OneClawClient) {
  return {
    name: "execute_http" as const,
    description:
      "Execute an HTTP request through a pre-configured binding. The binding's credential is injected server-side — the agent never sees it. Requires execution_intents_enabled on the agent.",
    parameters: z.object({
      binding: z
        .string()
        .describe("Name of the binding to use (e.g. 'github-api', 'stripe')"),
      method: z
        .enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"])
        .default("GET")
        .describe("HTTP method"),
      path: z.string().default("").describe("URL path appended to the binding's base_url"),
      headers: z
        .record(z.string())
        .optional()
        .describe("Additional HTTP headers to include"),
      body: z
        .record(z.unknown())
        .optional()
        .describe("JSON request body (for POST/PUT/PATCH)"),
      execution_mode: z
        .enum(["vault", "tee"])
        .default("vault")
        .describe("Execution surface: 'vault' (standard) or 'tee' (Shroud TEE, Business+ only)"),
    }),
    execute: async (args: {
      binding: string;
      method?: string;
      path?: string;
      headers?: Record<string, string>;
      body?: Record<string, unknown>;
      execution_mode?: string;
    }) => {
      try {
        const res = await client.post(
          `/v1/agents/${client.agentId}/execute`,
          {
            binding: args.binding,
            intent_type: "http",
            execution_mode: args.execution_mode ?? "vault",
            params: {
              method: args.method ?? "GET",
              path: args.path ?? "",
              headers: args.headers,
              body: args.body,
            },
          },
        );
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
