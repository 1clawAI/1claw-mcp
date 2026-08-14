import { z } from "zod";
import type { OneClawClient } from "../client.js";

export function getPolicyBackendSettingsTool(client: OneClawClient) {
    return {
        name: "get_policy_backend_settings" as const,
        description:
            "Get the organization's policy backend configuration including active backend (builtin, cedar, opa, builtin+cedar, builtin+opa), " +
            "evaluation mode (shadow or enforce), scope, and circuit breaker behavior.",
        parameters: z.object({}),
        execute: async (
            _args: Record<string, never>,
            { log }: { log: { info: (msg: string) => void } },
        ) => {
            const res = await client.getPolicyBackendSettings();
            log.info(`fetched policy backend settings: ${res.backend} (${res.mode})`);
            return JSON.stringify(res, null, 2);
        },
    };
}

export function updatePolicyBackendSettingsTool(client: OneClawClient) {
    return {
        name: "update_policy_backend_settings" as const,
        description:
            "Update the organization's policy backend settings. Can set backend type (builtin, cedar, opa, builtin+cedar, builtin+opa), " +
            "mode (shadow for testing, enforce for production), scope (which actions to evaluate), and circuit breaker behavior.",
        parameters: z.object({
            backend: z.enum(["builtin", "cedar", "opa", "builtin+cedar", "builtin+opa"]).optional()
                .describe("Policy backend to use"),
            mode: z.enum(["shadow", "enforce"]).optional()
                .describe("Evaluation mode: shadow (log divergences only) or enforce (block on deny)"),
            scope: z.array(z.string()).optional()
                .describe("Actions to evaluate (e.g. ['sign', 'submit_transaction']). Empty = all."),
            breaker_behavior: z.enum(["fail_closed", "fail_open_builtin"]).optional()
                .describe("Circuit breaker behavior on backend failure"),
        }),
        execute: async (
            args: {
                backend?: string;
                mode?: string;
                scope?: string[];
                breaker_behavior?: string;
            },
            { log }: { log: { info: (msg: string) => void } },
        ) => {
            const res = await client.updatePolicyBackendSettings(args);
            log.info(`updated policy backend settings: ${res.backend} (${res.mode})`);
            return `Policy backend updated.\n${JSON.stringify(res, null, 2)}`;
        },
    };
}

export function getShadowReportTool(client: OneClawClient) {
    return {
        name: "get_shadow_report" as const,
        description:
            "Get the policy shadow mode divergence report. Shows how often the advanced backend (Cedar/OPA) disagrees " +
            "with the builtin policy engine, with sample events for debugging.",
        parameters: z.object({}),
        execute: async (
            _args: Record<string, never>,
            { log }: { log: { info: (msg: string) => void } },
        ) => {
            const res = await client.getShadowReport();
            log.info(`shadow report: ${res.concordance_rate * 100}% concordance, ${res.divergent_count} divergences`);
            return JSON.stringify(res, null, 2);
        },
    };
}
