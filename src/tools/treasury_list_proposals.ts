import { z } from "zod";
import type { OneClawClient } from "../client.js";

export function treasuryListProposalsTool(client: OneClawClient) {
  return {
    name: "treasury_list_proposals" as const,
    description:
      "List multisig proposals for a Treasury Safe. Filter by status (pending, approved, executed, rejected).",
    parameters: z.object({
      treasury_id: z.string().describe("UUID of the treasury Safe"),
      status: z.string().optional().describe("Filter by status: pending, approved, executed, rejected"),
    }),
    execute: async (args: { treasury_id: string; status?: string }) => {
      const result = await client.treasuryListProposals(
        args.treasury_id,
        args.status,
      );
      return JSON.stringify(result, null, 2);
    },
  };
}
