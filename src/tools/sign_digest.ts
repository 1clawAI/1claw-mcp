import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawClient, OneClawApiError } from "../client.js";

export function signDigestTool(client: OneClawClient) {
  return {
    name: "sign_digest" as const,
    description:
      "Sign a client-computed 32-byte digest directly (raw/blind signing). Returns a 65-byte r‖s‖v ECDSA signature (v=27/28) that recovers to the signer EOA. " +
      "Use this for ERC-1271 / ERC-7739 nested EIP-712 flows (e.g. Polymarket CLOB orders) where the canonical hash is computed client-side and must match the verifier exactly. " +
      "WARNING: this is blind signing — no domain/transaction inspection is performed and guardrails are bypassed. The agent must have `raw_signing_enabled` set by a human, or the request returns 403. Every use is audit-logged.",
    parameters: z.object({
      agent_id: z.string().optional().describe("Agent ID. Uses the current authenticated agent if omitted."),
      hash: z
        .string()
        .regex(/^0x[0-9a-fA-F]{64}$/, "hash must be a 0x-prefixed 32-byte (64 hex char) digest")
        .describe("The 0x-prefixed 32-byte digest to sign directly"),
      chain: z.string().default("ethereum").describe("Chain name (default: ethereum)"),
      signing_key_path: z.string().optional().describe("Vault path to the signing key. Uses the agent's default key for the chain if omitted."),
    }),
    execute: async (
      args: {
        agent_id?: string;
        hash: string;
        chain?: string;
        signing_key_path?: string;
      },
      { log }: { log: { info: (msg: string) => void } },
    ) => {
      const agentId = args.agent_id || client.agentId;
      if (!agentId) {
        throw new UserError(
          "sign_digest requires an agent_id parameter or agent authentication (ONECLAW_AGENT_API_KEY).",
        );
      }

      try {
        const body: Record<string, unknown> = {
          intent_type: "eip712_digest",
          chain: args.chain ?? "ethereum",
          hash: args.hash,
        };
        if (args.signing_key_path) body.signing_key_path = args.signing_key_path;

        const result = await client.signIntent(agentId, body);
        log.info(`digest signed by ${result.from}`);

        const lines: string[] = [
          `Digest signed (raw ECDSA)`,
          `From: ${result.from}`,
          `Chain: ${result.chain}`,
        ];

        if (result.signature) lines.push(`Signature: ${result.signature}`);
        if (result.typed_data_hash) lines.push(`Digest: ${result.typed_data_hash}`);

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
