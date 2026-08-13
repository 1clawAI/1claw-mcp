import { z } from "zod";
import type { OneClawClient } from "../client.js";

export function listSubOrgsTool(client: OneClawClient) {
    return {
        name: "list_sub_orgs" as const,
        description:
            "List all sub-organizations under the current organization.",
        parameters: z.object({}),
        execute: async (
            _args: Record<string, never>,
            { log }: { log: { info: (msg: string) => void } },
        ) => {
            const res = await client.listSubOrgs();
            log.info(`listed ${res.sub_orgs.length} sub-orgs`);
            if (!res.sub_orgs.length) return "No sub-organizations found.";
            return JSON.stringify(res.sub_orgs, null, 2);
        },
    };
}
