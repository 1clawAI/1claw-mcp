import { z } from "zod";
import type { OneClawClient } from "../client.js";

export function testOpaPolicyTool(client: OneClawClient) {
    return {
        name: "test_opa_policy" as const,
        description:
            "Dry-run an OPA policy evaluation with an input document. Returns the authorization decision and policy result.",
        parameters: z.object({
            input: z.record(z.unknown()).describe("Input document for policy evaluation"),
            data: z.record(z.unknown()).optional().describe("Optional data override for the policy"),
        }),
        execute: async (
            args: { input: Record<string, unknown>; data?: Record<string, unknown> },
            { log }: { log: { info: (msg: string) => void } },
        ) => {
            const res = await client.testOpaPolicy(args.input, args.data);
            log.info(`OPA policy test: ${res.decision}`);
            return JSON.stringify(res, null, 2);
        },
    };
}
