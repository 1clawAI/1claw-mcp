import { z } from "zod";
import type { OneClawClient } from "../client.js";

export function platformMarketplaceTool(client: OneClawClient) {
  return {
    name: "platform_marketplace" as const,
    description:
      "List apps on the public 1Claw platform marketplace. Browse available integrations by category, tags, or search query. No authentication required.",
    parameters: z.object({
      query: z
        .string()
        .optional()
        .describe("Search query for app name or description"),
      category: z
        .string()
        .optional()
        .describe("Filter by category (e.g. 'defi', 'security', 'ai')"),
      tags: z
        .string()
        .optional()
        .describe("Comma-separated tags to filter by"),
    }),
    execute: async (
      args: { query?: string; category?: string; tags?: string },
      { log }: { log: { info: (msg: string) => void } },
    ) => {
      const result = (await client.platformMarketplace({
        q: args.query,
        category: args.category,
        tags: args.tags,
      })) as {
        apps: Array<{
          id: string;
          name: string;
          slug: string;
          description?: string;
          category?: string;
          listing_tags?: string[];
          pricing_summary?: string;
        }>;
        total?: number;
      };

      const apps = result.apps ?? [];
      log.info(`marketplace returned ${apps.length} app(s)`);

      if (apps.length === 0) {
        return "No apps found on the marketplace matching your criteria.";
      }

      const lines = apps.map((a) => {
        const parts = [
          `- ${a.name} (slug: ${a.slug}, id: ${a.id})`,
        ];
        if (a.description) parts.push(`  ${a.description.slice(0, 200)}`);
        if (a.category) parts.push(`  Category: ${a.category}`);
        if (a.listing_tags?.length) parts.push(`  Tags: ${a.listing_tags.join(", ")}`);
        if (a.pricing_summary) parts.push(`  Pricing: ${a.pricing_summary}`);
        return parts.join("\n");
      });

      return `Found ${result.total ?? apps.length} marketplace app(s):\n${lines.join("\n")}`;
    },
  };
}
