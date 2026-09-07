import { describe, it, expect } from "vitest";
import {
    platformGetFleetTool,
    platformListFleetAgentsTool,
    platformPlanFleetRolloutTool,
} from "../tools/platform_fleet.js";
import type { OneClawClient } from "../client.js";

/**
 * A fleet write applies to every agent one template provisioned. These tests
 * are about what the MCP surface deliberately cannot do.
 */
describe("platform fleet tools", () => {
    it("exposes no tool that mutates a fleet", async () => {
        const mod = await import("../tools/platform_fleet.js");
        const names = Object.keys(mod);
        // bulk-patch and pause exist in the API and the SDK. They are absent
        // here on purpose: a thousand agents changed from one call, with no
        // per-agent review, is a decision for a human at a terminal.
        expect(names.join(" ")).not.toMatch(/BulkPatch|Pause/i);
        expect(names).toHaveLength(3);
    });

    it("the rollout planner sets dry_run itself rather than accepting it", async () => {
        let sent: Record<string, unknown> | undefined;
        const client = {
            platformRolloutFleet: async (
                _a: string,
                _t: string,
                data: Record<string, unknown>,
            ) => {
                sent = data;
                return {
                    synced: 2,
                    to_version: 4,
                    already_current: 1,
                    skipped_drifted: 0,
                    outcomes: [],
                };
            },
        } as unknown as OneClawClient;

        const tool = platformPlanFleetRolloutTool(client);
        // The schema must not even offer a dry_run knob — a tool whose safety
        // depends on an argument the model chooses is not a safe tool.
        expect(Object.keys(tool.parameters.shape)).toEqual(["app_id", "template_id"]);

        const out = await tool.execute({
            app_id: "11111111-1111-1111-1111-111111111111",
            template_id: "22222222-2222-2222-2222-222222222222",
        });
        expect(sent).toEqual({ dry_run: true });
        expect(out).toContain("nothing was changed");
    });

    it("the fleet summary reports drift and says guardrails are not bulk-patchable", async () => {
        const client = {
            platformGetFleet: async () => ({
                template_name: "onboarding",
                template_id: "tpl-1",
                current_version: 3,
                total_agents: 10,
                agents_on_current_version: 7,
                agents_behind: 3,
                drifted_agents: 2,
                version_skew: [
                    { template_version: 2, agents: 3 },
                    { template_version: 3, agents: 7 },
                ],
                bulk_patchable_fields: ["system_prompt", "description"],
            }),
        } as unknown as OneClawClient;

        const out = await platformGetFleetTool(client).execute({
            app_id: "a",
            template_id: "t",
        });
        expect(out).toContain("3 behind");
        expect(out).toContain("Drifted (hand-edited; a rollout skips these): 2");
        expect(out).toContain("← current");
        expect(out).toContain("Guardrails and capability flags are not bulk-patchable");
    });

    it("an empty fleet says so rather than printing a bare header", async () => {
        const client = {
            platformListFleetAgents: async () => ({ agents: [] }),
        } as unknown as OneClawClient;
        const out = await platformListFleetAgentsTool(client).execute({
            app_id: "a",
            template_id: "t",
        });
        expect(out).toBe("No agents in this fleet.");
    });
});
