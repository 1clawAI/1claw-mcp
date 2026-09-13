import { describe, it, expect } from "vitest";
import {
    platformGetConnectionOtelSummaryTool,
    platformGetConnectionOtelThreatsTool,
    platformGetConnectionOtelTopologyTool,
} from "../tools/platform_expansion.js";
import type { OneClawClient } from "../client.js";

/**
 * The platform telemetry tools are read-only views of one connection. What
 * they must not do: expose the org-wide /v1/otel routes (a plt_ key is
 * refused there anyway), or the stream (a tool call that never returns).
 */
describe("platform otel tools", () => {
    it("exposes summary, threats and topology and nothing org-wide or streaming", async () => {
        const mod = await import("../tools/platform_expansion.js");
        const otel = Object.keys(mod).filter((n) => /Otel/i.test(n));
        expect(otel.sort()).toEqual([
            "platformGetConnectionOtelSummaryTool",
            "platformGetConnectionOtelThreatsTool",
            "platformGetConnectionOtelTopologyTool",
        ]);
    });

    it("every call carries the connection id and threats defaults to open", async () => {
        const calls: string[] = [];
        const client = {
            platformGetConnectionOtelSummary: async (c: string) => {
                calls.push(`summary:${c}`);
                return { posture_score: 100 };
            },
            platformGetConnectionOtelThreats: async (c: string, s: string) => {
                calls.push(`threats:${c}:${s}`);
                return [];
            },
            platformGetConnectionOtelTopology: async (c: string) => {
                calls.push(`topology:${c}`);
                return { nodes: [], edges: [] };
            },
        } as unknown as OneClawClient;
        const id = "11111111-1111-4111-8111-111111111111";
        await platformGetConnectionOtelSummaryTool(client).execute({ connection_id: id });
        await platformGetConnectionOtelThreatsTool(client).execute({ connection_id: id });
        await platformGetConnectionOtelThreatsTool(client).execute({ connection_id: id, state: "all" });
        await platformGetConnectionOtelTopologyTool(client).execute({ connection_id: id });
        expect(calls).toEqual([
            `summary:${id}`,
            `threats:${id}:open`,
            `threats:${id}:all`,
            `topology:${id}`,
        ]);
    });

    it("rejects a non-uuid connection id before any request", () => {
        const client = {} as OneClawClient;
        const r = platformGetConnectionOtelSummaryTool(client).parameters.safeParse({ connection_id: "nope" });
        expect(r.success).toBe(false);
    });
});
