import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawClient, OneClawApiError } from "../client.js";

export function getTransactionTool(client: OneClawClient) {
  return {
    name: "get_transaction" as const,
    description:
      "Get details of a specific transaction by ID. Returns chain, status, value, hash, and optionally the raw signed_tx hex.",
    parameters: z.object({
      transaction_id: z.string().describe("UUID of the transaction to retrieve"),
      include_signed_tx: z
        .boolean()
        .default(false)
        .describe("Include the raw signed_tx hex in the response"),
    }),
    execute: async (
      args: { transaction_id: string; include_signed_tx?: boolean },
      { log }: { log: { info: (msg: string) => void } },
    ) => {
      const agentId = client.agentId;
      if (!agentId) {
        throw new UserError("get_transaction requires agent authentication (ONECLAW_AGENT_ID).");
      }

      try {
        const tx = await client.getTransaction(agentId, args.transaction_id, {
          include_signed_tx: args.include_signed_tx,
        });
        log.info(`fetched transaction ${tx.id}`);

        const lines = [
          `ID: ${tx.id}`,
          `Agent: ${tx.agent_id}`,
          `Chain: ${tx.chain} (${tx.chain_id})`,
          `To: ${tx.to}`,
          `Value: ${tx.value_wei} wei`,
          `Status: ${tx.status}`,
        ];
        if (tx.tx_hash) lines.push(`Tx hash: ${tx.tx_hash}`);
        if (tx.signed_tx) lines.push(`Signed tx: ${tx.signed_tx}`);
        if (tx.error_message) lines.push(`Error: ${tx.error_message}`);
        if (tx.simulation_id) lines.push(`Simulation: ${tx.simulation_id} (${tx.simulation_status})`);
        lines.push(`Created: ${tx.created_at}`);
        if (tx.signed_at) lines.push(`Signed: ${tx.signed_at}`);

        return lines.join("\n");
      } catch (err) {
        if (err instanceof OneClawApiError) {
          if (err.status === 404) throw new UserError(`Transaction ${args.transaction_id} not found.`);
          if (err.status === 403) throw new UserError(`Access denied: ${err.detail}`);
        }
        throw err;
      }
    },
  };
}
