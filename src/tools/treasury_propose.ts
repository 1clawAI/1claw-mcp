import { z } from "zod";
import type { OneClawClient } from "../client.js";

export function treasuryProposeTool(client: OneClawClient) {
  return {
    name: "treasury_propose" as const,
    description:
      "Submit a new multisig proposal for a Treasury Safe. Requires an active treasury delegation for the calling agent.",
    parameters: z.object({
      treasury_id: z.string().describe("UUID of the treasury Safe"),
      to: z.string().describe("Destination address (0x-prefixed)"),
      value_wei: z.string().optional().describe("Value in wei (defaults to '0')"),
      data: z.string().optional().describe("Hex-encoded calldata (defaults to '0x')"),
      operation: z.number().int().optional().describe("0=Call, 1=DelegateCall (defaults to 0)"),
      safe_tx_hash: z.string().describe("EIP-712 Safe tx hash (computed off-chain)"),
      nonce: z.number().int().describe("Safe nonce at time of proposal"),
    }),
    execute: async (args: {
      treasury_id: string;
      to: string;
      value_wei?: string;
      data?: string;
      operation?: number;
      safe_tx_hash: string;
      nonce: number;
    }) => {
      const result = await client.treasuryPropose(args.treasury_id, {
        to: args.to,
        value_wei: args.value_wei,
        data: args.data,
        operation: args.operation,
        safe_tx_hash: args.safe_tx_hash,
        nonce: args.nonce,
      });
      return JSON.stringify(result, null, 2);
    },
  };
}
