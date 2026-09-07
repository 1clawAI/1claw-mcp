import { z } from "zod";
import type { OneClawClient } from "../client.js";

/**
 * Read-only and dry-run-only fleet tools.
 *
 * A fleet write applies to every agent one template provisioned — a thousand
 * agents from one call, with no per-agent review. That is a decision for a
 * human at a terminal (`1claw platform fleet rollout`) or a deliberate SDK
 * call, not something an agent should be able to do because it seemed like a
 * good idea mid-conversation. So bulk-patch and pause are deliberately absent
 * here, and rollout is exposed as a planner: it always sends dry_run, and says
 * so in its description and its output.
 */

export function platformGetFleetTool(client: OneClawClient) {
  return {
    name: "platform_get_fleet" as const,
    description:
      "Fleet summary for a platform template: how many agents it provisioned, how they split across the template versions they were built from, how many are behind, and how many a previous rollout skipped because they were hand-edited. Read-only.",
    parameters: z.object({
      app_id: z.string().uuid().describe("The platform app ID"),
      template_id: z.string().uuid().describe("The template whose fleet to summarise"),
    }),
    execute: async (args: { app_id: string; template_id: string }) => {
      const f = await client.platformGetFleet(args.app_id, args.template_id);
      const skew = (f.version_skew as { template_version: number | null; agents: number }[]) ?? [];
      const lines = skew.map(
        (b) =>
          `  v${b.template_version ?? "(unstamped)"}: ${b.agents} agent(s)${
            b.template_version === f.current_version ? " ← current" : ""
          }`,
      );
      return [
        `Fleet "${f.template_name}" (template ${f.template_id})`,
        `Current version: ${f.current_version}`,
        `Agents: ${f.total_agents} — ${f.agents_on_current_version} current, ${f.agents_behind} behind`,
        `Drifted (hand-edited; a rollout skips these): ${f.drifted_agents}`,
        skew.length ? `Version skew:\n${lines.join("\n")}` : "",
        `Bulk-patchable fields: ${((f.bulk_patchable_fields as string[]) ?? []).join(", ")}`,
        "Guardrails and capability flags are not bulk-patchable — they stay per-agent.",
      ]
        .filter(Boolean)
        .join("\n");
    },
  };
}

export function platformListFleetAgentsTool(client: OneClawClient) {
  return {
    name: "platform_list_fleet_agents" as const,
    description:
      "List the agents in a platform template's fleet, with the version each was provisioned from and any fields a rollout skipped. Read-only.",
    parameters: z.object({
      app_id: z.string().uuid().describe("The platform app ID"),
      template_id: z.string().uuid().describe("The template whose fleet to list"),
      limit: z.number().int().min(1).max(500).optional().describe("Page size (default 50)"),
      offset: z.number().int().min(0).optional().describe("Offset (default 0)"),
    }),
    execute: async (args: {
      app_id: string;
      template_id: string;
      limit?: number;
      offset?: number;
    }) => {
      const res = await client.platformListFleetAgents(
        args.app_id,
        args.template_id,
        args.limit,
        args.offset,
      );
      const agents =
        (res.agents as Record<string, unknown>[] | undefined) ?? [];
      if (agents.length === 0) return "No agents in this fleet.";
      const lines = agents.map((a) => {
        const drift = (a.drift_fields as string[]) ?? [];
        return `- ${a.name} (${a.agent_id}) v${a.provisioned_from_version ?? "?"}${
          a.is_current ? " current" : " BEHIND"
        }${drift.length ? ` drifted: ${drift.join(",")}` : ""}${
          a.is_active ? "" : " [paused]"
        }`;
      });
      return `${agents.length} agent(s):\n${lines.join("\n")}`;
    },
  };
}

export function platformPlanFleetRolloutTool(client: OneClawClient) {
  return {
    name: "platform_plan_fleet_rollout" as const,
    description:
      "Plan (dry-run) a fleet rollout: report which agents would be synced to the template's current version and which would be skipped because they were changed outside fleet control. This ALWAYS runs as a dry run and never changes anything. To actually apply a rollout, a human runs `1claw platform fleet rollout`.",
    parameters: z.object({
      app_id: z.string().uuid().describe("The platform app ID"),
      template_id: z.string().uuid().describe("The template to plan a rollout for"),
    }),
    execute: async (args: { app_id: string; template_id: string }) => {
      // dry_run is set here, not taken from the caller. A tool whose safety
      // depends on an argument the model chooses is not a safe tool.
      const r = await client.platformRolloutFleet(args.app_id, args.template_id, {
        dry_run: true,
      });
      const skipped =
        ((r.outcomes as Record<string, unknown>[] | undefined) ?? []).filter(
          (o) => o.outcome === "skipped_drifted",
        );
      const detail = skipped
        .slice(0, 20)
        .map(
          (s) =>
            `  ${s.agent_id} — ${((s.drift_fields as string[]) ?? []).join(", ")}`,
        );
      return [
        `Dry run — nothing was changed.`,
        `Would sync ${r.synced} agent(s) to v${r.to_version}.`,
        `Already current: ${r.already_current}. Would skip ${r.skipped_drifted} hand-edited agent(s).`,
        skipped.length ? `Skipped:\n${detail.join("\n")}` : "",
        skipped.length > 20 ? `  … and ${skipped.length - 20} more` : "",
      ]
        .filter(Boolean)
        .join("\n");
    },
  };
}
