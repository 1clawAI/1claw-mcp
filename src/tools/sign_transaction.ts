import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawClient, OneClawApiError } from "../client.js";

export function signTransactionTool(client: OneClawClient) {
  return {
    name: "sign_transaction" as const,
    description:
      "Sign an EVM transaction without broadcasting it. Returns the raw signed_tx hex and tx_hash so the caller can submit to any RPC. All agent guardrails (allowlists, value caps, daily limits) are enforced. Use this when the agent needs to broadcast via its own RPC endpoint.",
    parameters: z.object({
      to: z.string().describe("Destination address (0x-prefixed)"),
      value: z.string().describe("Value in ETH as decimal string (e.g. '0.01')"),
      chain: z.string().describe("Chain name ('base', 'ethereum', etc.) or numeric chain ID"),
      data: z.string().optional().describe("Hex-encoded calldata for contract interactions"),
      signing_key_path: z.string().optional().describe("Vault path to the signing key. Auto-resolves per-chain signing key if provisioned, otherwise keys/{chain}-signer"),
      nonce: z.number().int().optional().describe("Transaction nonce (auto-resolved if omitted)"),
      gas_price: z.string().optional().describe("Gas price in wei (legacy mode)"),
      gas_limit: z.number().int().optional().describe("Gas limit. Defaults to 21000"),
      max_fee_per_gas: z.string().optional().describe("EIP-1559 max fee per gas in wei"),
      max_priority_fee_per_gas: z.string().optional().describe("EIP-1559 max priority fee per gas in wei"),
      simulate_first: z.boolean().default(true).describe("Run Tenderly simulation before signing. Defaults to true."),
    }),
    execute: async (
      args: {
        to: string;
        value: string;
        chain: string;
        data?: string;
        signing_key_path?: string;
        nonce?: number;
        gas_price?: string;
        gas_limit?: number;
        max_fee_per_gas?: string;
        max_priority_fee_per_gas?: string;
        simulate_first?: boolean;
      },
      { log }: { log: { info: (msg: string) => void } },
    ) => {
      const agentId = client.agentId;
      if (!agentId) {
        throw new UserError(
          "sign_transaction requires agent authentication (ONECLAW_AGENT_API_KEY, or ONECLAW_AGENT_ID + key; agent ID is resolved from token exchange when omitted).",
        );
      }

      try {
        const result = await client.signTransaction(agentId, args);
        log.info(`transaction signed: ${result.tx_hash}`);

        const lines: string[] = [
          `Transaction SIGNED (not broadcast)`,
          `Tx hash: ${result.tx_hash}`,
          `From: ${result.from}`,
          `To: ${result.to}`,
          `Chain: ${result.chain} (${result.chain_id})`,
          `Nonce: ${result.nonce}`,
          `Value: ${result.value_wei} wei`,
          `Signed tx: ${result.signed_tx}`,
        ];

        if (result.simulation_id) lines.push(`Simulation: ${result.simulation_id} (${result.simulation_status})`);

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
