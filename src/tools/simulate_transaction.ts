import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawClient, OneClawApiError } from "../client.js";

export function simulateTransactionTool(client: OneClawClient) {
  return {
    name: "simulate_transaction" as const,
    description:
      "Simulate an EVM transaction via Tenderly without signing or broadcasting. Returns balance changes, gas estimates, and success/revert status. Use this to preview what a transaction will do before committing real funds.",
    parameters: z.object({
      to: z.string().describe("Destination address (0x-prefixed)"),
      value: z.string().describe("Value in ETH as decimal string (e.g. '0.01')"),
      chain: z.string().describe("Chain name ('base', 'ethereum', etc.) or numeric chain ID"),
      data: z.string().optional().describe("Hex-encoded calldata for contract interactions"),
      signing_key_path: z.string().optional().describe("Vault path to the signing key. Defaults to keys/{chain}-signer"),
      gas_limit: z.number().int().optional().describe("Gas limit. Defaults to 21000"),
    }),
    execute: async (
      args: {
        to: string;
        value: string;
        chain: string;
        data?: string;
        signing_key_path?: string;
        gas_limit?: number;
      },
      { log }: { log: { info: (msg: string) => void } },
    ) => {
      const agentId = client.agentId;
      if (!agentId) {
        throw new UserError("simulate_transaction requires agent authentication (ONECLAW_AGENT_ID).");
      }

      try {
        const result = await client.simulateTransaction(agentId, args);
        log.info(`simulation: ${result.status} (gas: ${result.gas_used})`);

        const lines: string[] = [
          `Simulation ${result.status.toUpperCase()}`,
          `Gas used: ${result.gas_used}`,
        ];

        if (result.gas_estimate_usd) {
          lines.push(`Gas estimate: ${result.gas_estimate_usd}`);
        }

        if (result.balance_changes.length > 0) {
          lines.push("", "Balance changes:");
          for (const bc of result.balance_changes) {
            const token = bc.token_symbol ?? bc.token ?? "ETH";
            lines.push(`  ${bc.address}: ${bc.change ?? "?"} ${token}`);
          }
        }

        if (result.error) {
          lines.push("", `Error: ${result.error}`);
        }
        if (result.error_human_readable) {
          lines.push(`Reason: ${result.error_human_readable}`);
        }
        if (result.tenderly_dashboard_url) {
          lines.push("", `Tenderly: ${result.tenderly_dashboard_url}`);
        }

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
