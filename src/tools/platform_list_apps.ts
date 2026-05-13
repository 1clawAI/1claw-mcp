import { z } from "zod";
import type { OneClawClient } from "../client.js";

export function platformListAppsTool(client: OneClawClient) {
  return {
    name: "platform_list_apps" as const,
    description:
      "List all platform apps in your organization. Platform apps enable multi-tenant integrations where third-party apps can provision vaults, agents, and policies for their users.",
    parameters: z.object({}),
    execute: async () => {
      const data = await client.platformListApps();
      const apps = data.apps;

      if (apps.length === 0) {
        return "No platform apps found. Create one with platform_create_app.";
      }

      const lines = apps.map(
        (a) =>
          `- ${a.name} (slug: ${a.slug}, id: ${a.id}, users: ${a.connected_users}, billing: ${a.billing_model})`,
      );

      return `Found ${apps.length} platform app(s):\n${lines.join("\n")}`;
    },
  };
}
