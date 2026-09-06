import { z } from "zod";
import { OneClawClient, OneClawApiError } from "../client.js";

interface Preset {
  slug: string;
  display_name: string;
  description: string;
  category: string;
  provider_slug: string | null;
  oauth_scopes: string[];
  required_scopes: string[];
  base_url: string;
  allowed_hosts: string[];
  documentation_url: string;
  requires_oauth: boolean;
}

export function listConnectorPresetsTool(client: OneClawClient) {
  return {
    name: "list_connector_presets" as const,
    description:
      "List the pre-built connectors an agent can be given — Gmail, Slack, GitHub, " +
      "Notion and others. Each says which scopes it asks for and which hosts the " +
      "resulting binding may reach. Installing one requires a human.",
    parameters: z.object({
      category: z
        .string()
        .optional()
        .describe("Filter by category, e.g. 'communication', 'productivity', 'development'"),
    }),
    execute: async (
      args: { category?: string },
      { log }: { log: { info: (msg: string) => void } },
    ) => {
      try {
        const result = (await client.listConnectorPresets()) as { presets?: Preset[] };
        let presets = result.presets ?? [];
        if (args.category) {
          presets = presets.filter((p) => p.category === args.category);
        }
        log.info(`listed ${presets.length} connector preset(s)`);

        if (presets.length === 0) {
          return args.category
            ? `No connectors in category '${args.category}'.`
            : "No connectors available.";
        }

        return presets
          .map((p) => {
            const parts = [
              `Slug: ${p.slug}`,
              `Name: ${p.display_name}`,
              `Category: ${p.category}`,
              `Description: ${p.description}`,
              `Base URL: ${p.base_url}`,
            ];
            if (p.requires_oauth) {
              parts.push(`OAuth provider: ${p.provider_slug}`);
              if (p.oauth_scopes.length) {
                parts.push(`Scopes: ${p.oauth_scopes.join(", ")}`);
              }
            } else {
              parts.push("Auth: API key supplied by the user (no OAuth flow)");
            }
            parts.push(`Docs: ${p.documentation_url}`);
            return parts.join("\n");
          })
          .join("\n---\n");
      } catch (err) {
        if (err instanceof OneClawApiError && err.status === 403) {
          throw new Error(`Access denied: ${err.detail}`);
        }
        throw err;
      }
    },
  };
}
