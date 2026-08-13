import { z } from "zod";
import type { OneClawClient } from "../client.js";

export function listOpaPoliciesTool(client: OneClawClient) {
    return {
        name: "list_opa_policies" as const,
        description:
            "List all OPA (Open Policy Agent) policies configured for the organization.",
        parameters: z.object({}),
        execute: async (
            _args: Record<string, never>,
            { log }: { log: { info: (msg: string) => void } },
        ) => {
            const res = await client.listOpaPolicies();
            log.info(`listed ${res.policies.length} OPA policies`);
            if (!res.policies.length) return "No OPA policies found.";
            return JSON.stringify(res.policies, null, 2);
        },
    };
}
