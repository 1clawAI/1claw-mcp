import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawClient, OneClawApiError } from "../client.js";

export function listApprovalsTool(client: OneClawClient) {
  return {
    name: "list_approvals" as const,
    description:
      "List pending approval requests. Returns approvals that are awaiting human decision.",
    parameters: z.object({
      status: z
        .enum(["pending", "approved", "rejected", "expired"])
        .optional()
        .describe("Filter by approval status (default: all)"),
      limit: z
        .number()
        .default(20)
        .describe("Maximum number of approvals to return"),
    }),
    execute: async (
      args: { status?: string; limit?: number },
      { log }: { log: { info: (msg: string) => void } },
    ) => {
      try {
        const result = await client.listApprovals({
          status: args.status,
          limit: args.limit,
        });
        const approvals = result.approvals ?? [];
        log.info(`listed ${approvals.length} approval(s)`);

        if (approvals.length === 0) return "No approvals found.";

        return approvals
          .map((a) => {
            const parts = [
              `ID: ${a.id}`,
              `Status: ${a.status}`,
              `Action: ${a.action}`,
            ];
            if (a.human_summary) parts.push(`Summary: ${a.human_summary}`);
            if (a.target_type) parts.push(`Target: ${a.target_type}`);
            if (a.target_id) parts.push(`Target ID: ${a.target_id}`);
            if (a.risk_tier) parts.push(`Risk tier: ${a.risk_tier}`);
            if (a.agent_id) parts.push(`Agent: ${a.agent_id}`);
            if (a.reason) parts.push(`Reason: ${a.reason}`);
            parts.push(`Created: ${a.created_at}`);
            if (a.decided_at) parts.push(`Decided: ${a.decided_at}`);
            if (a.expires_at) parts.push(`Expires: ${a.expires_at}`);
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
