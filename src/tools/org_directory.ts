import { z } from "zod";
import type { OneClawClient } from "../client.js";

interface OrgAgent {
  id: string;
  name: string;
  description: string;
  tags: string[];
  capabilities: string[];
  a2a_url?: string;
  mcp_url?: string;
}

export function orgDirectoryTool(client: OneClawClient) {
  return {
    name: "org_directory" as const,
    description:
      "List agents in your organization for sub-agent discovery. Returns agents with their capabilities.",
    parameters: z.object({
      q: z.string().optional().describe("Search query"),
      tags: z.string().optional().describe("Comma-separated tags"),
      page: z.number().int().optional().describe("Page number"),
      page_size: z.number().int().optional().describe("Results per page"),
    }),
    execute: async (
      args: { q?: string; tags?: string; page?: number; page_size?: number },
      { log }: { log: { info: (msg: string) => void } },
    ) => {
      const resp = (await client.orgDirectory(args)) as {
        agents: OrgAgent[];
        total: number;
        page: number;
      };

      log.info(`org directory returned ${resp.total} results`);

      if (resp.agents.length === 0) {
        return "No agents found in your organization.";
      }

      const lines = resp.agents.map(
        (a) =>
          `Name: ${a.name}\n` +
          `ID: ${a.id}\n` +
          `Description: ${(a.description || "").slice(0, 500)}\n` +
          `Capabilities: ${(a.capabilities || []).join(", ")}\n` +
          `Tags: ${(a.tags || []).join(", ")}` +
          (a.a2a_url ? `\nA2A URL: ${a.a2a_url}` : "") +
          (a.mcp_url ? `\nMCP URL: ${a.mcp_url}` : ""),
      );

      return `Found ${resp.total} agent(s) in your org (page ${resp.page}):\n\n${lines.join("\n---\n")}`;
    },
  };
}
