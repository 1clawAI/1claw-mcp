import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawClient, OneClawApiError } from "../client.js";

export function listTransactionsTool(client: OneClawClient) {
  return {
    name: "list_transactions" as const,
    description:
      "List recent transactions for the current agent. Returns transaction IDs, chains, statuses, and amounts. Signed transaction hex is omitted by default.",
    parameters: z.object({
      include_signed_tx: z
        .boolean()
        .default(false)
        .describe("Include the raw signed_tx hex in each result"),
    }),
    execute: async (
      args: { include_signed_tx?: boolean },
      { log }: { log: { info: (msg: string) => void } },
    ) => {
      const agentId = client.agentId;
      if (!agentId) {
        throw new UserError("list_transactions requires agent authentication (ONECLAW_AGENT_ID).");
      }

      try {
        const result = await client.listTransactions(agentId, {
          include_signed_tx: args.include_signed_tx,
        });
        const txs = result.transactions ?? [];
        log.info(`listed ${txs.length} transaction(s)`);

        if (txs.length === 0) return "No transactions found for this agent.";

        return txs
          .map((tx) => {
            const parts = [
              `ID: ${tx.id}`,
              `Chain: ${tx.chain} (${tx.chain_id})`,
              `To: ${tx.to}`,
              `Value: ${tx.value_wei} wei`,
              `Status: ${tx.status}`,
            ];
            if (tx.tx_hash) parts.push(`Hash: ${tx.tx_hash}`);
            if (tx.signed_tx) parts.push(`Signed: ${tx.signed_tx}`);
            parts.push(`Created: ${tx.created_at}`);
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
