import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawClient, OneClawApiError } from "../client.js";

export function getApprovalTool(client: OneClawClient) {
  return {
    name: "get_approval" as const,
    description:
      "Get details of a specific approval request by ID.",
    parameters: z.object({
      approval_id: z.string().describe("UUID of the approval request to retrieve"),
    }),
    execute: async (
      args: { approval_id: string },
      { log }: { log: { info: (msg: string) => void } },
    ) => {
      try {
        const approval = await client.getApproval(args.approval_id);
        log.info(`fetched approval ${approval.id}`);

        const lines = [
          `ID: ${approval.id}`,
          `Status: ${approval.status}`,
          `Action: ${approval.action}`,
        ];
        // These are `target_*`, not `resource_*` — the old names never appeared in
        // an API response, so this tool showed the action and nothing about what
        // it was for.
        if (approval.target_type) lines.push(`Target: ${approval.target_type}`);
        if (approval.target_id) lines.push(`Target ID: ${approval.target_id}`);
        if (approval.human_summary) lines.push(`Summary: ${approval.human_summary}`);
        if (approval.risk_tier) lines.push(`Risk tier: ${approval.risk_tier}`);
        if (approval.agent_id) lines.push(`Agent: ${approval.agent_id}`);
        if (approval.reason) lines.push(`Reason: ${approval.reason}`);
        if (approval.summary && Object.keys(approval.summary).length > 0) {
          lines.push(`Details: ${JSON.stringify(approval.summary)}`);
        }
        if (approval.payload && Object.keys(approval.payload).length > 0) {
          lines.push(`Payload: ${JSON.stringify(approval.payload)}`);
        }
        if (approval.decision_reason) {
          lines.push(`Decision reason: ${approval.decision_reason}`);
        }
        if (approval.decided_by) lines.push(`Decided by: ${approval.decided_by}`);
        if (approval.decided_at) lines.push(`Decided: ${approval.decided_at}`);
        lines.push(`Created: ${approval.created_at}`);
        if (approval.expires_at) lines.push(`Expires: ${approval.expires_at}`);

        return lines.join("\n");
      } catch (err) {
        if (err instanceof OneClawApiError) {
          if (err.status === 404) throw new UserError(`Approval ${args.approval_id} not found.`);
          if (err.status === 403) throw new UserError(`Access denied: ${err.detail}`);
        }
        throw err;
      }
    },
  };
}
