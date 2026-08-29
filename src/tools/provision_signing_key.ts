import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawClient, OneClawApiError } from "../client.js";

export function provisionSigningKeyTool(client: OneClawClient) {
  return {
    name: "provision_signing_key" as const,
    description:
      "Generate a signing key for an agent on a given blockchain. Returns the public key, on-chain address (when applicable), and key metadata. The private key is stored securely in the vault and never exposed.",
    parameters: z.object({
      agent_id: z.string().optional().describe("Agent ID. Uses the current authenticated agent if omitted."),
      chain: z
        .enum(["ethereum", "bitcoin", "solana", "xrp", "cardano", "tron", "midnight"])
        .describe("Blockchain to generate the signing key for"),
    }),
    execute: async (
      args: { agent_id?: string; chain: string },
      { log }: { log: { info: (msg: string) => void } },
    ) => {
      const agentId = args.agent_id || client.agentId;
      if (!agentId) {
        throw new UserError(
          "provision_signing_key requires an agent_id parameter or agent authentication (ONECLAW_AGENT_API_KEY).",
        );
      }

      try {
        const result = await client.provisionSigningKey(agentId, args.chain);
        log.info(`signing key provisioned: ${result.chain} (${result.id})`);

        const lines: string[] = [
          `Signing key provisioned for ${result.chain}`,
          `Key ID: ${result.id}`,
          `Curve: ${result.curve}`,
          `Public key: ${result.public_key}`,
        ];

        if (result.address) lines.push(`Address: ${result.address}`);
        lines.push(`Version: ${result.key_version}`);
        lines.push(`Active: ${result.is_active}`);

        return lines.join("\n");
      } catch (err) {
        if (err instanceof OneClawApiError) {
          if (err.status === 400) throw new UserError(err.detail);
          if (err.status === 403) throw new UserError(`Access denied: ${err.detail}`);
          if (err.status === 409) throw new UserError(`Key already exists: ${err.detail}`);
        }
        throw err;
      }
    },
  };
}
