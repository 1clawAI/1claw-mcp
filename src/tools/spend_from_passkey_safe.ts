import { z } from "zod";
import { UserError } from "fastmcp";
import type { OneClawClient } from "../client.js";
import { OneClawApiError } from "../client/core.js";

/**
 * Spend from a human's passkey-owned Safe (custody: passkey_owner) under an
 * on-chain Allowance Module grant the owner signed for this agent. The cap is
 * enforced by the module on chain; the agent's guardrails and the sanctions
 * screen run first. Above the remaining allowance the request is refused
 * before any gas is spent.
 */
export function spendFromPasskeySafeTool(client: OneClawClient) {
  return {
    name: "spend_from_passkey_safe" as const,
    description:
      "Spend from a passkey-owned Safe under an active Allowance Module grant the Safe's owner signed for this agent. " +
      "Amount is in base units (wei / token minor units). Omit token for the native token. The on-chain cap, the agent's guardrails and the sanctions screen all apply; counts as one signature.",
    parameters: z.object({
      safe_id: z.string().uuid().describe("The passkey Safe's id (from the owner's dashboard or GET /v1/treasury/passkey-safes)"),
      to: z.string().describe("Recipient address (0x…)"),
      amount: z.string().regex(/^\d+$/).describe("Base units as a decimal string"),
      token: z.string().optional().describe("ERC-20 contract address; omit for the native token"),
    }),
    execute: async (
      args: { safe_id: string; to: string; amount: string; token?: string },
      { log }: { log: { info: (msg: string) => void } },
    ) => {
      const agentId = client.agentId;
      if (!agentId) {
        throw new UserError(
          "spend_from_passkey_safe requires agent authentication (ONECLAW_AGENT_API_KEY, or ONECLAW_AGENT_ID + key).",
        );
      }
      try {
        const response = await client.spendFromPasskeySafe(agentId, args.safe_id, {
          to: args.to,
          amount: args.amount,
          ...(args.token ? { token: args.token } : {}),
        });
        log.info(`Allowance spend broadcast from Safe ${args.safe_id}`);
        return JSON.stringify(response, null, 2);
      } catch (err) {
        if (err instanceof OneClawApiError) {
          if (err.status === 403) throw new UserError(`Refused: ${err.detail}`);
          if (err.status === 404) throw new UserError("Passkey Safe not found, or no active grant for this agent on it.");
          if (err.status === 409) throw new UserError(`Not ready: ${err.detail}`);
        }
        throw err;
      }
    },
  };
}
