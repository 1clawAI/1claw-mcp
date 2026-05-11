import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawClient, OneClawApiError } from "../client.js";

export function listSigningKeysTool(client: OneClawClient) {
  return {
    name: "list_signing_keys" as const,
    description:
      "List all signing keys for an agent across all chains. Returns key IDs, chains, curves, public keys, and addresses.",
    parameters: z.object({
      agent_id: z.string().optional().describe("Agent ID. Uses the current authenticated agent if omitted."),
    }),
    execute: async (
      args: { agent_id?: string },
      { log }: { log: { info: (msg: string) => void } },
    ) => {
      const agentId = args.agent_id || client.agentId;
      if (!agentId) {
        throw new UserError(
          "list_signing_keys requires an agent_id parameter or agent authentication (ONECLAW_AGENT_API_KEY).",
        );
      }

      try {
        const result = await client.listSigningKeys(agentId);
        const keys = result.keys ?? [];
        log.info(`listed ${keys.length} signing key(s)`);

        if (keys.length === 0) return "No signing keys found for this agent.";

        return keys
          .map((k) => {
            const parts = [
              `Key ID: ${k.id}`,
              `Chain: ${k.chain}`,
              `Curve: ${k.curve}`,
              `Public key: ${k.public_key}`,
            ];
            if (k.address) parts.push(`Address: ${k.address}`);
            parts.push(`Version: ${k.key_version}`);
            parts.push(`Active: ${k.is_active}`);
            parts.push(`Created: ${k.created_at}`);
            return parts.join("\n");
          })
          .join("\n---\n");
      } catch (err) {
        if (err instanceof OneClawApiError) {
          if (err.status === 403) throw new UserError(`Access denied: ${err.detail}`);
        }
        throw err;
      }
    },
  };
}
