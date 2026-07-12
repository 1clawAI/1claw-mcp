import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawClient, OneClawApiError } from "../client.js";

/** Run a connectivity test against a binding (routed through the same SSRF and
 * host-allowlist checks as execute). */
export function testBindingTool(client: OneClawClient) {
  return {
    name: "test_binding" as const,
    description:
      "Test connectivity for a binding by id. Runs through the same SSRF/allowlist checks as execution and returns success + latency.",
    parameters: z.object({
      binding_id: z.string().describe("The binding's UUID"),
      timeout_ms: z
        .number()
        .int()
        .min(100)
        .max(60000)
        .optional()
        .describe("Connectivity timeout in milliseconds (default 5000)"),
    }),
    execute: async (args: { binding_id: string; timeout_ms?: number }) => {
      try {
        const agentId = client.agentId;
        if (!agentId) {
          throw new UserError("Agent ID not resolved. Ensure ONECLAW_AGENT_API_KEY is set.");
        }
        const res = await client.testBinding(agentId, args.binding_id, args.timeout_ms);
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
