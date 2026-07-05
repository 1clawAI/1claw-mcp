import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawClient, OneClawApiError } from "../client.js";

export function getSigningKeyBalanceTool(client: OneClawClient) {
  return {
    name: "get_signing_key_balance" as const,
    description:
      "Get the balance of an agent's signing key on a specific chain. Returns native balance and optionally token balances.",
    parameters: z.object({
      chain: z
        .string()
        .describe("Chain name (e.g. ethereum, solana, bitcoin)"),
      tokens: z
        .string()
        .optional()
        .describe(
          "Comma-separated list of token contract addresses to query balances for (EVM only)"
        ),
    }),
    execute: async (
      args: { chain: string; tokens?: string },
      { log }: { log: { info: (msg: string) => void } }
    ) => {
      const agentId = client.agentId;
      if (!agentId) {
        throw new UserError(
          "get_signing_key_balance requires agent authentication (ONECLAW_AGENT_API_KEY, or ONECLAW_AGENT_ID + key; agent ID is resolved from token exchange when omitted).",
        );
      }

      try {
        const response = await client.getSigningKeyBalance(agentId, args.chain, args.tokens);
        log.info(`Balance fetched for ${args.chain}`);
        return JSON.stringify(response, null, 2);
      } catch (err) {
        if (err instanceof OneClawApiError) {
          if (err.status === 403) throw new UserError(`Access denied: ${err.detail}`);
          if (err.status === 404) throw new UserError(`No signing key found for chain '${args.chain}'.`);
        }
        throw err;
      }
    },
  };
}
