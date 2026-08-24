import { z } from "zod";
import { UserError } from "fastmcp";
import type { OneClawClient } from "../client.js";
import { OneClawApiError } from "../client.js";

export function listAgentAccountsTool(client: OneClawClient) {
    return {
        name: "list_agent_accounts" as const,
        description:
            "List agent on-chain accounts (EOA and Safe) per chain. Returns account type, address, deploy status, and enabled modules.",
        parameters: z.object({
            agent_id: z
                .string()
                .optional()
                .describe("Agent UUID. Uses the authenticated agent if omitted."),
        }),
        execute: async (
            args: { agent_id?: string },
            { log }: { log: { info: (msg: string) => void } },
        ) => {
            const agentId = args.agent_id || client.agentId;
            if (!agentId) {
                throw new UserError(
                    "list_agent_accounts requires agent_id or agent authentication (ONECLAW_AGENT_API_KEY).",
                );
            }
            try {
                const res = await client.listAgentAccounts(agentId);
                log.info(`listed ${res.accounts.length} account(s) for agent ${agentId}`);
                return JSON.stringify(res, null, 2);
            } catch (err) {
                if (err instanceof OneClawApiError) {
                    if (err.status === 403) throw new UserError(`Access denied: ${err.detail}`);
                    if (err.status === 404) throw new UserError(`Agent not found: ${err.detail}`);
                }
                throw err;
            }
        },
    };
}

export function migrateAgentToSafeTool(client: OneClawClient) {
    return {
        name: "migrate_agent_to_safe" as const,
        description:
            "Build an EOA→Safe migration plan and provision a counterfactual Safe account (human-only). " +
            "No on-chain deploy broadcast — returns safe_address, config hashes, and warnings.",
        parameters: z.object({
            agent_id: z.string().describe("Agent UUID"),
            chain: z.string().describe("Chain name (e.g. ethereum, base, sepolia)"),
            deprecate_eoa: z
                .boolean()
                .optional()
                .describe("When true, mark the EOA account deprecated after migration"),
        }),
        execute: async (
            args: { agent_id: string; chain: string; deprecate_eoa?: boolean },
            { log }: { log: { info: (msg: string) => void } },
        ) => {
            try {
                const plan = await client.migrateAgentToSafe(args.agent_id, {
                    chain: args.chain,
                    deprecate_eoa: args.deprecate_eoa,
                });
                log.info(`migration plan stored for agent ${args.agent_id} on ${args.chain}`);
                return JSON.stringify(plan, null, 2);
            } catch (err) {
                if (err instanceof OneClawApiError) {
                    if (err.status === 403) throw new UserError(`Access denied: ${err.detail}`);
                    if (err.status === 404) throw new UserError(`Agent not found: ${err.detail}`);
                }
                throw err;
            }
        },
    };
}

export function deprecateAgentEoaTool(client: OneClawClient) {
    return {
        name: "deprecate_agent_eoa" as const,
        description:
            "Mark the agent EOA account deprecated for a chain (human-only). Blocks direct EOA signing path.",
        parameters: z.object({
            agent_id: z.string().describe("Agent UUID"),
            chain: z.string().describe("Chain name (e.g. ethereum, base)"),
        }),
        execute: async (
            args: { agent_id: string; chain: string },
            { log }: { log: { info: (msg: string) => void } },
        ) => {
            try {
                const row = await client.deprecateAgentEoa(args.agent_id, args.chain);
                log.info(`EOA deprecated for agent ${args.agent_id} on ${args.chain}`);
                return JSON.stringify(row, null, 2);
            } catch (err) {
                if (err instanceof OneClawApiError) {
                    if (err.status === 403) throw new UserError(`Access denied: ${err.detail}`);
                    if (err.status === 404) throw new UserError(`Account not found: ${err.detail}`);
                }
                throw err;
            }
        },
    };
}

export function getSafeModuleRegistryTool(client: OneClawClient) {
    return {
        name: "get_safe_module_registry" as const,
        description:
            "List pinned Safe module addresses for a chain (public). Returns Guard and Zodiac module addresses per chain.",
        parameters: z.object({
            chain: z.string().describe("Chain name (e.g. ethereum, base, sepolia)"),
        }),
        execute: async (
            args: { chain: string },
            { log }: { log: { info: (msg: string) => void } },
        ) => {
            const res = await client.getSafeModuleRegistry(args.chain);
            log.info(`module registry for ${args.chain}: ${res.modules.length} module(s)`);
            return JSON.stringify(res, null, 2);
        },
    };
}

export function syncOrgSafeAllowancesTool(client: OneClawClient) {
    return {
        name: "sync_org_safe_allowances" as const,
        description:
            "Reconcile org Safe allowance configs against agent guardrails (owner/admin only). " +
            "Counterfactual — compiles targets and reports drift without on-chain broadcast.",
        parameters: z.object({}),
        execute: async (
            _args: Record<string, never>,
            { log }: { log: { info: (msg: string) => void } },
        ) => {
            try {
                const res = await client.syncOrgSafeAllowances();
                log.info(
                    `allowance sync: ${res.agents_checked} agent(s), ${res.drift_detected.length} drift entry(ies)`,
                );
                return JSON.stringify(res, null, 2);
            } catch (err) {
                if (err instanceof OneClawApiError) {
                    if (err.status === 403) throw new UserError(`Access denied: ${err.detail}`);
                }
                throw err;
            }
        },
    };
}
