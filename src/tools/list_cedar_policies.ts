import { z } from "zod";
import type { OneClawClient } from "../client.js";

export function listCedarPoliciesTool(client: OneClawClient) {
    return {
        name: "list_cedar_policies" as const,
        description:
            "List all Cedar policies configured for the organization. Cedar provides fine-grained authorization using a declarative policy language.",
        parameters: z.object({}),
        execute: async (
            _args: Record<string, never>,
            { log }: { log: { info: (msg: string) => void } },
        ) => {
            const res = await client.listCedarPolicies();
            log.info(`listed ${res.policies.length} cedar policies`);
            if (!res.policies.length) return "No Cedar policies found.";
            return JSON.stringify(res.policies, null, 2);
        },
    };
}
