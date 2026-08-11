import { z } from "zod";
import type { OneClawClient } from "../client.js";

export function platformListTemplatesTool(client: OneClawClient) {
  return {
    name: "platform_list_templates" as const,
    description:
      "List all bootstrap templates for a platform app. Templates define what resources are provisioned for connected users.",
    parameters: z.object({
      app_id: z.string().uuid().describe("The platform app ID"),
    }),
    execute: async (args: { app_id: string }) => {
      const data = await client.platformListTemplates(args.app_id);
      const templates = data.templates ?? [];
      if (templates.length === 0) {
        return "No templates found for this app.";
      }
      const lines = templates.map(
        (t: Record<string, unknown>) =>
          `- ${t.name} (id: ${t.id}, version: ${t.version}, active: ${t.is_active})`,
      );
      return `Found ${templates.length} template(s):\n${lines.join("\n")}`;
    },
  };
}
