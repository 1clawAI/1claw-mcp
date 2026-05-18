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
        if (approval.resource_type) lines.push(`Resource: ${approval.resource_type}`);
        if (approval.resource_id) lines.push(`Resource ID: ${approval.resource_id}`);
        if (approval.agent_id) lines.push(`Agent: ${approval.agent_id}`);
        if (approval.reason) lines.push(`Reason: ${approval.reason}`);
        if (approval.metadata) lines.push(`Metadata: ${JSON.stringify(approval.metadata)}`);
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
