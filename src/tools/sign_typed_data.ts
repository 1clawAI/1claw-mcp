import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawClient, OneClawApiError } from "../client.js";

export function signTypedDataTool(client: OneClawClient) {
  return {
    name: "sign_typed_data" as const,
    description:
      "Sign EIP-712 typed structured data. Accepts a full EIP-712 typed data JSON object (with types, primaryType, domain, and message). Returns the signature, typed data hash, and signer address. Agent guardrails are enforced.",
    parameters: z.object({
      agent_id: z.string().optional().describe("Agent ID. Uses the current authenticated agent if omitted."),
      typed_data: z
        .record(z.unknown())
        .describe("EIP-712 typed data object with types, primaryType, domain, and message fields"),
      chain: z.string().default("ethereum").describe("Chain name (default: ethereum)"),
      signing_key_path: z.string().optional().describe("Vault path to the signing key. Uses the agent's default key for the chain if omitted."),
    }),
    execute: async (
      args: {
        agent_id?: string;
        typed_data: Record<string, unknown>;
        chain?: string;
        signing_key_path?: string;
      },
      { log }: { log: { info: (msg: string) => void } },
    ) => {
      const agentId = args.agent_id || client.agentId;
      if (!agentId) {
        throw new UserError(
          "sign_typed_data requires an agent_id parameter or agent authentication (ONECLAW_AGENT_API_KEY).",
        );
      }

      try {
        const body: Record<string, unknown> = {
          intent_type: "typed_data",
          chain: args.chain ?? "ethereum",
          typed_data: args.typed_data,
        };
        if (args.signing_key_path) body.signing_key_path = args.signing_key_path;

        const result = await client.signIntent(agentId, body);
        log.info(`typed data signed by ${result.from}`);

        const lines: string[] = [
          `Typed data signed (EIP-712)`,
          `From: ${result.from}`,
          `Chain: ${result.chain}`,
        ];

        if (result.signature) lines.push(`Signature: ${result.signature}`);
        if (result.typed_data_hash) lines.push(`Typed data hash: ${result.typed_data_hash}`);

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
