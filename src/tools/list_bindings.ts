import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawClient, OneClawApiError } from "../client.js";

export function listBindingsTool(client: OneClawClient) {
  return {
    name: "list_bindings" as const,
    description:
      "List all active bindings for the current agent. Bindings are pre-configured credential handles for external services.",
    parameters: z.object({}),
    execute: async () => {
      try {
        const agentId = client.agentId;
        if (!agentId) {
          throw new UserError("Agent ID not resolved. Ensure ONECLAW_AGENT_API_KEY is set.");
        }
        const res = await client.listBindings(agentId);
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
