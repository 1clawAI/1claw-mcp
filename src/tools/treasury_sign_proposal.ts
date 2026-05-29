import { z } from "zod";
import type { OneClawClient } from "../client.js";

export function treasurySignProposalTool(client: OneClawClient) {
  return {
    name: "treasury_sign_proposal" as const,
    description:
      "Sign (approve or reject) a pending Treasury multisig proposal. If the approve threshold is met, the proposal may auto-execute.",
    parameters: z.object({
      treasury_id: z.string().describe("UUID of the treasury Safe"),
      proposal_id: z.string().describe("UUID of the proposal"),
      signature: z.string().describe("Hex-encoded EIP-712 signature"),
      signer_address: z.string().describe("Signer's Ethereum address (0x-prefixed)"),
      decision: z.enum(["approve", "reject"]).default("approve").describe("Whether to approve or reject"),
    }),
    execute: async (args: {
      treasury_id: string;
      proposal_id: string;
      signature: string;
      signer_address: string;
      decision?: "approve" | "reject";
    }) => {
      const result = await client.treasurySignProposal(
        args.treasury_id,
        args.proposal_id,
        {
          signature: args.signature,
          signer_address: args.signer_address,
          decision: args.decision ?? "approve",
        },
      );
      return JSON.stringify(result, null, 2);
    },
  };
}
