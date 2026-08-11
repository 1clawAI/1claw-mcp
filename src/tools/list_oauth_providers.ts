import { z } from "zod";
import { OneClawClient, OneClawApiError } from "../client.js";

export function listOAuthProvidersTool(client: OneClawClient) {
  return {
    name: "list_oauth_providers" as const,
    description:
      "List all available OAuth providers for agent connections (Google, GitHub, Slack, etc.)",
    parameters: z.object({}),
    execute: async (
      _args: Record<string, never>,
      { log }: { log: { info: (msg: string) => void } },
    ) => {
      try {
        const result = await client.listOAuthProviders() as {
          providers: Array<{
            slug: string;
            name: string;
            description?: string;
            scopes?: string[];
            is_enabled: boolean;
          }>;
        };

        const providers = result.providers ?? [];
        log.info(`listed ${providers.length} OAuth provider(s)`);

        if (providers.length === 0) return "No OAuth providers available.";

        return providers
          .map((p) => {
            const parts = [
              `Slug: ${p.slug}`,
              `Name: ${p.name}`,
            ];
            if (p.description) parts.push(`Description: ${p.description}`);
            if (p.scopes?.length) parts.push(`Scopes: ${p.scopes.join(", ")}`);
            parts.push(`Enabled: ${p.is_enabled}`);
            return parts.join("\n");
          })
          .join("\n---\n");
      } catch (err) {
        if (err instanceof OneClawApiError) {
          if (err.status === 403) {
            throw new Error(`Access denied: ${err.detail}`);
          }
        }
        throw err;
      }
    },
  };
}
