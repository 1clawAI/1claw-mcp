import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawClient, OneClawApiError } from "../client.js";

export function requestApprovalTool(client: OneClawClient) {
  return {
    name: "request_approval" as const,
    description:
      "Request human approval for a policy change or sensitive action. Creates a pending approval that the agent's human operator must review.",
    parameters: z.object({
      action: z
        .string()
        .describe("Type of action being requested (e.g. 'policy_change', 'access_request')"),
      target_type: z
        .string()
        .describe("Type of target resource (e.g. 'policy', 'vault', 'secret')"),
      target_id: z
        .string()
        .describe("ID of the target resource"),
      summary: z
        .record(z.unknown())
        .describe("JSON summary of the requested change. For policy_change: { vault_id, paths, permissions, conditions }"),
      reason: z
        .string()
        .optional()
        .describe("Human-readable reason for the request"),
      risk_tier: z
        .number()
        .optional()
        .describe("Risk level 1-5 (1=low, 5=critical). Default: 1"),
    }),
    execute: async (
      args: {
        action: string;
        target_type: string;
        target_id: string;
        summary: Record<string, unknown>;
        reason?: string;
        risk_tier?: number;
      },
      { log }: { log: { info: (msg: string) => void } },
    ) => {
      try {
        const result = await client.requestApproval({
          action: args.action,
          target_type: args.target_type,
          target_id: args.target_id,
          summary: args.summary,
          reason: args.reason,
          risk_tier: args.risk_tier,
        });
        log.info(`approval requested: ${result.id}`);
        return `Approval request created successfully.\nID: ${result.id}\nStatus: ${result.status}\nThe human operator will be notified to review this request.`;
      } catch (err) {
        if (err instanceof OneClawApiError) {
          if (err.status === 403)
            throw new UserError(`Access denied: ${err.detail}`);
          if (err.status === 400)
            throw new UserError(`Bad request: ${err.detail}`);
        }
        throw err;
      }
    },
  };
}
