import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawApiError, type OneClawClient } from "../client.js";

const workflowStepSchema = z.object({
  type: z.string(),
  params: z.record(z.unknown()).optional(),
  name: z.string().optional(),
});

export function createAgentAutomationTool(client: OneClawClient) {
  return {
    name: "create_agent_automation" as const,
    description:
      "Create a simple automation for the calling agent (manual or webhook trigger). " +
      "Allowed steps: log, notify, memory_get, memory_put, wait (max 10). " +
      "Use auto_trigger=true to run immediately after creation (manual only). " +
      "Agents cannot create cron, swap, http, or transaction automations — use request_approval for those.",
    parameters: z.object({
      name: z.string().min(1).max(128).describe("Short automation name"),
      trigger_type: z.enum(["manual", "webhook"]).optional().default("manual"),
      workflow_spec: z
        .union([
          z.array(workflowStepSchema),
          z.object({ steps: z.array(workflowStepSchema) }),
        ])
        .describe("Workflow with log, notify, memory_get, memory_put, or wait steps"),
      auto_trigger: z
        .boolean()
        .optional()
        .default(false)
        .describe("When true (manual only), trigger the run immediately after creation"),
    }),
    execute: async (
      args: {
        name: string;
        trigger_type?: "manual" | "webhook";
        workflow_spec: unknown;
        auto_trigger?: boolean;
      },
      { log }: { log: { info: (msg: string) => void } },
    ) => {
      const agentId = client.agentId;
      if (!agentId) {
        throw new UserError("Agent ID not configured. Set ONECLAW_AGENT_ID or use agent token exchange.");
      }

      try {
        const result = await client.createAgentAutomation(agentId, {
          name: args.name,
          trigger_type: args.trigger_type ?? "manual",
          workflow_spec: args.workflow_spec,
          auto_trigger: args.auto_trigger ?? false,
        });
        log.info(`created agent automation: ${args.name}`);
        const automation = (result as { id?: string; name?: string }).id
          ? result
          : (result as { automation?: Record<string, unknown> }).automation ?? result;
        const id = typeof automation.id === "string" ? automation.id : "unknown";
        const webhookUrl =
          typeof (result as { webhook_url?: string }).webhook_url === "string"
            ? (result as { webhook_url: string }).webhook_url
            : undefined;
        let summary = `Created automation "${args.name}" (id: ${id}).`;
        if (webhookUrl) summary += ` Webhook URL: ${webhookUrl}`;
        if (args.auto_trigger) summary += " Run triggered.";
        return summary;
      } catch (err) {
        if (err instanceof OneClawApiError) {
          if (err.status === 403) throw new UserError(`Access denied: ${err.detail}`);
          if (err.status === 400) throw new UserError(`Invalid automation: ${err.detail}`);
        }
        throw err;
      }
    },
  };
}
