import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawClient, OneClawApiError } from "../client.js";

export function getApprovalStatusTool(client: OneClawClient) {
  return {
    name: "get_approval_status" as const,
    description:
      "Poll lightweight approval status (agent-only). Returns status and expires_at for an approval the calling agent created.",
    parameters: z.object({
      approval_id: z
        .string()
        .describe("UUID of the approval request to poll"),
    }),
    execute: async (
      args: { approval_id: string },
      { log }: { log: { info: (msg: string) => void } },
    ) => {
      try {
        const status = await client.getApprovalStatus(args.approval_id);
        log.info(`polled approval status ${args.approval_id}: ${status.status}`);
        return JSON.stringify(status, null, 2);
      } catch (err) {
        if (err instanceof OneClawApiError) {
          if (err.status === 404) {
            throw new UserError(`Approval ${args.approval_id} not found.`);
          }
          if (err.status === 403) {
            throw new UserError(
              `Access denied: agents can only poll their own approval requests.`,
            );
          }
        }
        throw err;
      }
    },
  };
}
