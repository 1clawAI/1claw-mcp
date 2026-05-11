import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawClient, OneClawApiError } from "../client.js";

export function signMessageTool(client: OneClawClient) {
  return {
    name: "sign_message" as const,
    description:
      "Sign a message using EIP-191 personal_sign. The message should be a hex-encoded string. Returns the signature and the signer address. Agent guardrails are enforced.",
    parameters: z.object({
      agent_id: z.string().optional().describe("Agent ID. Uses the current authenticated agent if omitted."),
      message: z.string().describe("Hex-encoded message to sign (0x-prefixed or raw hex)"),
      chain: z.string().default("ethereum").describe("Chain name (default: ethereum)"),
      signing_key_path: z.string().optional().describe("Vault path to the signing key. Uses the agent's default key for the chain if omitted."),
    }),
    execute: async (
      args: {
        agent_id?: string;
        message: string;
        chain?: string;
        signing_key_path?: string;
      },
      { log }: { log: { info: (msg: string) => void } },
    ) => {
      const agentId = args.agent_id || client.agentId;
      if (!agentId) {
        throw new UserError(
          "sign_message requires an agent_id parameter or agent authentication (ONECLAW_AGENT_API_KEY).",
        );
      }

      try {
        const body: Record<string, unknown> = {
          intent_type: "personal_sign",
          chain: args.chain ?? "ethereum",
          message: args.message,
        };
        if (args.signing_key_path) body.signing_key_path = args.signing_key_path;

        const result = await client.signIntent(agentId, body);
        log.info(`message signed by ${result.from}`);

        const lines: string[] = [
          `Message signed (EIP-191 personal_sign)`,
          `From: ${result.from}`,
          `Chain: ${result.chain}`,
        ];

        if (result.signature) lines.push(`Signature: ${result.signature}`);
        if (result.message_hash) lines.push(`Message hash: ${result.message_hash}`);

        return lines.join("\n");
      } catch (err) {
        if (err instanceof OneClawApiError) {
          if (err.status === 400) throw new UserError(err.detail);
          if (err.status === 403) throw new UserError(`Access denied: ${err.detail}`);
        }
        throw err;
      }
    },
  };
}
