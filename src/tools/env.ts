import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawClient, OneClawApiError } from "../client.js";

export const getEnvBundleTool = (client: OneClawClient) => ({
    name: "get_env_bundle",
    description:
        "Fetch a secret of type env_bundle, parse its KEY=VALUE lines, and return a structured JSON object. Useful for injecting environment variables into subprocesses.",
    parameters: z.object({
        path: z.string().min(1).describe("Path to an env_bundle secret"),
    }),
    execute: async (
        args: { path: string },
        context: { log: { info: (msg: string) => void } },
    ) => {
        try {
            const secret = await client.getSecret(args.path);
            context.log.info(`env_bundle accessed: ${args.path}`);

            if (secret.type !== "env_bundle") {
                throw new UserError(
                    `Secret at '${args.path}' is type '${secret.type}', not 'env_bundle'.`,
                );
            }

            const env: Record<string, string> = {};
            for (const line of secret.value.split("\n")) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith("#")) continue;
                const eqIdx = trimmed.indexOf("=");
                if (eqIdx === -1) continue;
                env[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
            }

            return JSON.stringify(env, null, 2);
        } catch (err) {
            if (err instanceof OneClawApiError) {
                if (err.status === 410) {
                    throw new UserError(
                        `Secret at path '${args.path}' is expired or has exceeded its maximum access count.`,
                    );
                }
                if (err.status === 404) {
                    throw new UserError(
                        `No secret found at path '${args.path}'.`,
                    );
                }
            }
            throw err;
        }
    },
});

export const resolveEnvTool = (client: OneClawClient) => ({
    name: "resolve_env",
    description:
        "Resolve environment variables for a vault, returning the final KEY=VALUE set with precedence applied (shared < vault < branch override). If environment is omitted, the agent's tagged environment is used automatically.",
    parameters: z.object({
        environment: z
            .string()
            .optional()
            .describe(
                "Target environment (production, preview, development, or custom). Omit to use the agent's tagged environment.",
            ),
        git_branch: z
            .string()
            .optional()
            .describe("Optional git branch for preview overrides"),
    }),
    execute: async (
        args: { environment?: string; git_branch?: string },
        context: { log: { info: (msg: string) => void } },
    ) => {
        const result = await client.resolveEnvVars(args.environment, args.git_branch);
        const envLabel = args.environment ?? "(agent default)";
        context.log.info(
            `Resolved env vars for ${envLabel}${args.git_branch ? ` (branch: ${args.git_branch})` : ""}: ${Object.keys(result.vars ?? {}).length} variables`,
        );
        return JSON.stringify(result, null, 2);
    },
});
