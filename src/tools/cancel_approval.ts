import { z } from "zod";
import { UserError } from "fastmcp";
import type { OneClawClient } from "../client.js";
import { OneClawApiError } from "../client/core.js";

/**
 * Withdraw a pending approval this agent requested. First answer wins: if the
 * human already decided, the existing decision comes back unchanged.
 */
export function cancelApprovalTool(client: OneClawClient) {
  return {
    name: "cancel_approval" as const,
    description:
      "Cancel a pending approval you requested (e.g. it was answered locally, or is no longer needed). " +
      "If the human decided first, the existing decision is returned instead — first answer wins.",
    parameters: z.object({
      approval_id: z.string().uuid().describe("The approval id"),
      reason: z.string().max(500).optional().describe("Why it is being withdrawn"),
    }),
    execute: async (
      args: { approval_id: string; reason?: string },
      { log }: { log: { info: (msg: string) => void } },
    ) => {
      try {
        const a = await client.cancelApproval(args.approval_id, args.reason);
        log.info(`approval ${args.approval_id} → ${a.status}`);
        return a.status === "cancelled"
          ? `Approval ${a.id} cancelled.`
          : `Approval ${a.id} was already ${a.status}; nothing changed.`;
      } catch (err) {
        if (err instanceof OneClawApiError) {
          if (err.status === 403) throw new UserError(`Refused: ${err.detail}`);
          if (err.status === 404) throw new UserError("Approval not found.");
        }
        throw err;
      }
    },
  };
}
