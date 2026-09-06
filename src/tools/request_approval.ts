import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawClient, OneClawApiError } from "../client.js";

export function requestApprovalTool(client: OneClawClient) {
  return {
    name: "request_approval" as const,
    description:
      "Ask a human to approve an action, and get back an approval id to poll. " +
      "Use this for business actions your operator should see before they happen — " +
      "issuing a refund, posting publicly, sending an invoice — as well as for " +
      "requesting wider access for yourself.",
    parameters: z.object({
      action: z
        .string()
        .describe(
          "A business action named 'namespace.verb' (e.g. 'refund.create', 'social.post', " +
            "'invoice.send'), or one of the access requests 'access_request', " +
            "'policy_request', 'binding_request'. Actions 1Claw executes itself on approval " +
            "(card orders, transactions, policy changes) are created by the platform and " +
            "will be rejected here.",
        ),
      target_type: z
        .string()
        .describe("What kind of thing this is about (e.g. 'order', 'vault', 'channel')"),
      target_id: z.string().describe("ID of that thing"),
      summary: z
        .record(z.unknown())
        .describe(
          "What the human is shown: { title, body, fields: [{ label, value }] }. " +
            "Write it for someone who has no context on the task.",
        ),
      payload: z
        .record(z.unknown())
        .optional()
        .describe(
          "What the action will actually do — { amount_usd, customer_email, recipient, ... }. " +
            "Keep it accurate: the server decides how strong the approval must be from this, " +
            "not from the summary, and a summary that disagrees with it is visible to your operator.",
        ),
      reason: z.string().optional().describe("Why you are asking"),
      declared_risk_tier: z
        .number()
        .int()
        .min(1)
        .max(3)
        .optional()
        .describe(
          "Optional. How sensitive you believe this is: 1 low, 2 elevated, 3 sensitive. " +
            "The server derives its own tier from policy and the payload and takes the higher " +
            "of the two — you can ask for a stricter review, never a weaker one.",
        ),
    }),
    execute: async (
      args: {
        action: string;
        target_type: string;
        target_id: string;
        summary: Record<string, unknown>;
        payload?: Record<string, unknown>;
        reason?: string;
        declared_risk_tier?: number;
      },
      { log }: { log: { info: (msg: string) => void } },
    ) => {
      try {
        const result = await client.requestApproval({
          action: args.action,
          target_type: args.target_type,
          target_id: args.target_id,
          summary: args.summary,
          payload: args.payload,
          reason: args.reason,
          declared_risk_tier: args.declared_risk_tier,
        });
        log.info(`approval requested: ${result.id}`);

        const lines = [
          "Approval request created.",
          `ID: ${result.id}`,
          `Status: ${result.status}`,
          `Risk tier enforced: ${result.risk_tier}`,
        ];
        // Worth telling the agent plainly: it asked for less than policy allows,
        // which usually means its own understanding of the action is wrong.
        if (result.declared_below_floor) {
          lines.push(
            `Note: you asked for tier ${result.declared_risk_tier}, but this agent's policy ` +
              `requires tier ${result.risk_tier} for this action.`,
          );
        }
        if (result.human_summary) {
          lines.push(`Your operator will see: "${result.human_summary}"`);
        }
        lines.push("Poll get_approval_status with this ID for the decision.");
        return lines.join("\n");
      } catch (err) {
        if (err instanceof OneClawApiError) {
          if (err.status === 403) throw new UserError(`Access denied: ${err.detail}`);
          if (err.status === 400) throw new UserError(`Bad request: ${err.detail}`);
        }
        throw err;
      }
    },
  };
}
