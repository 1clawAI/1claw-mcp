import { z } from "zod";
import type { OneClawClient } from "../client.js";

export function getGuardrailShadowReportTool(client: OneClawClient) {
    return {
        name: "get_guardrail_shadow_report" as const,
        description:
            "Get Convention 6 guardrail shadow report — violations that would be denied if enforcement mode were on.",
        parameters: z.object({
            since: z.string().optional().describe("RFC3339 start timestamp"),
            until: z.string().optional().describe("RFC3339 end timestamp"),
        }),
        execute: async (
            args: { since?: string; until?: string },
            { log }: { log: { info: (msg: string) => void } },
        ) => {
            const res = await client.getGuardrailShadowReport(args);
            log.info(`guardrail shadow: ${res.total_would_deny} would-deny`);
            return JSON.stringify(res, null, 2);
        },
    };
}

export function listGuardrailRevisionsTool(client: OneClawClient) {
    return {
        name: "list_guardrail_revisions" as const,
        description: "List guardrail revision history for agent and binding guardrail changes.",
        parameters: z.object({}),
        execute: async (
            _args: Record<string, never>,
            { log }: { log: { info: (msg: string) => void } },
        ) => {
            const res = await client.listGuardrailRevisions();
            log.info(`listed ${res.revisions.length} guardrail revisions`);
            return JSON.stringify(res, null, 2);
        },
    };
}

export function replayAgentGuardrailsTool(client: OneClawClient) {
    return {
        name: "replay_agent_guardrails" as const,
        description: "Dry-run draft guardrails against an agent's recent transactions.",
        parameters: z.object({
            agent_id: z.string().uuid(),
            days: z.number().int().min(1).max(90).optional(),
            draft_guardrails: z.record(z.unknown()).optional(),
            draft_approval_policy: z.record(z.unknown()).optional(),
        }),
        execute: async (
            args: {
                agent_id: string;
                days?: number;
                draft_guardrails?: Record<string, unknown>;
                draft_approval_policy?: Record<string, unknown>;
            },
            { log }: { log: { info: (msg: string) => void } },
        ) => {
            const res = await client.replayAgentGuardrails(args.agent_id, {
                days: args.days,
                draft_guardrails: args.draft_guardrails,
                draft_approval_policy: args.draft_approval_policy,
            });
            log.info(`replay complete for agent ${args.agent_id}`);
            return JSON.stringify(res, null, 2);
        },
    };
}
