import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawClient, OneClawApiError } from "../client.js";

export function platformCreateTemplateTool(client: OneClawClient) {
  return {
    name: "platform_create_template" as const,
    description:
      "Create a bootstrap template for a platform app. The template spec defines vaults, agents, policies, and signing keys provisioned for each connected user.",
    parameters: z.object({
      app_id: z.string().uuid().describe("The platform app ID"),
      name: z.string().min(1).describe("Template name"),
      description: z.string().optional().describe("Template description"),
      spec: z.string().describe("Template spec as a JSON string"),
    }),
    execute: async (
      args: { app_id: string; name: string; description?: string; spec: string },
      { log }: { log: { info: (msg: string) => void } },
    ) => {
      let spec: Record<string, unknown>;
      try {
        spec = JSON.parse(args.spec);
      } catch {
        throw new UserError("spec must be valid JSON");
      }
      try {
        const result = await client.platformCreateTemplate(args.app_id, {
          name: args.name,
          description: args.description,
          spec,
        });
        log.info(`template created: ${(result as Record<string, unknown>).id}`);
        return [
          `Template created successfully.`,
          `  ID: ${(result as Record<string, unknown>).id}`,
          `  Name: ${(result as Record<string, unknown>).name}`,
          `  Version: ${(result as Record<string, unknown>).version}`,
        ].join("\n");
      } catch (err) {
        if (err instanceof OneClawApiError) {
          if (err.status === 400) throw new UserError(err.detail);
          if (err.status === 403) throw new UserError(`Access denied: ${err.detail}`);
        }
        throw err;
      }
    },
  };
}
