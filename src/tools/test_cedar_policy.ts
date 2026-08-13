import { z } from "zod";
import type { OneClawClient } from "../client.js";

export function testCedarPolicyTool(client: OneClawClient) {
    return {
        name: "test_cedar_policy" as const,
        description:
            "Dry-run a Cedar policy evaluation against a principal, action, and resource. Returns the authorization decision and matching policy reasons.",
        parameters: z.object({
            principal: z.string().describe("Principal identifier (e.g. 'Agent::\"<uuid>\"')"),
            action: z.string().describe("Action to test (e.g. 'Action::\"read\"')"),
            resource: z.string().describe("Resource identifier (e.g. 'Secret::\"path/to/secret\"')"),
            context: z.record(z.unknown()).optional().describe("Optional context object for condition evaluation"),
        }),
        execute: async (
            args: { principal: string; action: string; resource: string; context?: Record<string, unknown> },
            { log }: { log: { info: (msg: string) => void } },
        ) => {
            const res = await client.testCedarPolicy(args.principal, args.action, args.resource, args.context);
            log.info(`cedar policy test: ${res.decision}`);
            return JSON.stringify(res, null, 2);
        },
    };
}
