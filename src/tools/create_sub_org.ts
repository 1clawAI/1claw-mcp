import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawClient, OneClawApiError } from "../client.js";

export function createSubOrgTool(client: OneClawClient) {
    return {
        name: "create_sub_org" as const,
        description:
            "Create a new sub-organization under the current organization.",
        parameters: z.object({
            name: z.string().min(1).max(128).describe("Sub-organization name"),
            description: z.string().optional().describe("Description"),
            billing_model: z
                .enum(["inherit", "independent"])
                .default("inherit")
                .describe("Billing model for the sub-organization"),
        }),
        execute: async (
            args: { name: string; description?: string; billing_model: string },
            { log }: { log: { info: (msg: string) => void } },
        ) => {
            try {
                const res = await client.createSubOrg(args.name, args.description, args.billing_model);
                log.info(`sub-org created: ${res.name}`);
                return `Sub-organization created: ${res.name} (${res.id})`;
            } catch (err) {
                if (err instanceof OneClawApiError) {
                    if (err.status === 400) throw new UserError(err.detail);
                    if (err.status === 403) throw new UserError(`Access denied: ${err.detail}`);
                    if (err.status === 409) throw new UserError(`Conflict: ${err.detail}`);
                }
                throw err;
            }
        },
    };
}
