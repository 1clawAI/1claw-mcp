import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawClient, OneClawApiError } from "../client.js";

export function submitTransactionTool(client: OneClawClient) {
  return {
    name: "submit_transaction" as const,
    description:
      "Submit an EVM transaction to be signed by 1claw's crypto proxy and optionally broadcast. Supports legacy and EIP-1559 fee modes. Set simulate_first=true to run a Tenderly simulation before signing (recommended).",
    parameters: z.object({
      to: z.string().describe("Destination address (0x-prefixed)"),
      value: z.string().describe("Value in ETH as decimal string (e.g. '0.01')"),
      chain: z.string().describe("Chain name ('base', 'ethereum', etc.) or numeric chain ID"),
      data: z.string().optional().describe("Hex-encoded calldata for contract interactions"),
      signing_key_path: z.string().optional().describe("Vault path to the signing key. Defaults to keys/{chain}-signer"),
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
        throw new UserError("submit_transaction requires agent authentication (ONECLAW_AGENT_ID).");
      }

      try {
        const result = await client.submitTransaction(agentId, args);
        log.info(`transaction: ${result.status} (${result.id})`);

        const lines: string[] = [
          `Transaction ${result.status.toUpperCase()}`,
          `ID: ${result.id}`,
          `Chain: ${result.chain} (${result.chain_id})`,
          `To: ${result.to}`,
          `Value: ${result.value_wei} wei`,
        ];

        if (result.tx_hash) lines.push(`Tx hash: ${result.tx_hash}`);
        if (result.simulation_id) lines.push(`Simulation: ${result.simulation_id} (${result.simulation_status})`);
        if (result.error_message) lines.push(`Error: ${result.error_message}`);

        return lines.join("\n");
      } catch (err) {
        if (err instanceof OneClawApiError) {
          if (err.status === 400) throw new UserError(err.detail);
          if (err.status === 403) throw new UserError(`Access denied: ${err.detail}`);
          if (err.status === 422) throw new UserError(`Transaction rejected: ${err.detail}`);
        }
        throw err;
      }
    },
  };
}
