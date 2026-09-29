/**
 * Ask a human for a credential, without it entering the conversation.
 *
 * The failure this replaces: asked to post daily to X, an agent went looking
 * for a CLI, tried to read raw API keys out of the vault, and started writing
 * a curl script — because the only way its user could hand it a credential
 * was to type one into the chat box. A pasted secret is persisted to the
 * conversation, copied into the agent's memory, and replayed to the model on
 * every later turn.
 *
 * Here the human gets a secure field in the dashboard. The value goes from
 * their browser straight to the vault; the agent learns a path.
 */

import { z } from "zod";
import { UserError } from "fastmcp";
import type { OneClawClient } from "../client.js";
import { OneClawApiError } from "../client/core.js";

export function requestSecretTool(client: OneClawClient) {
    return {
        name: "request_secret" as const,
        description:
            "Ask your human for a credential you do not have. They get a secure field in the " +
            "1Claw dashboard; the value goes straight to the vault and you are told the path, " +
            "never the secret itself. " +
            "Use this instead of asking them to paste a key into the chat — anything typed " +
            "there is stored in the conversation, written into your memory, and sent to the " +
            "model on every later turn. " +
            "Returns a request id: poll check_secret_request for it, and get on with anything " +
            "that does not depend on the answer in the meantime.",
        parameters: z.object({
            label: z
                .string()
                .max(120)
                .describe(
                    "What you need, named the way its owner would name it — " +
                        "'X API access token', 'Postgres connection string'. Asking again with " +
                        "the same label refreshes your existing request rather than sending a " +
                        "second one.",
                ),
            purpose: z
                .string()
                .max(500)
                .describe(
                    "Why you need it, for someone with no context on the task. They are being " +
                        "asked to hand over a secret; 'To post your daily update to X' earns " +
                        "that, 'for the task' does not.",
                ),
            suggested_path: z
                .string()
                .optional()
                .describe(
                    "Optional vault path you suggest, e.g. 'api-keys/x-access-token'. A " +
                        "suggestion only — they pick the vault and may change it.",
                ),
        }),
        execute: async (
            args: { label: string; purpose: string; suggested_path?: string },
            { log }: { log: { info: (msg: string) => void } },
        ) => {
            try {
                const result = await client.createSecretRequest(args);
                log.info(`secret requested: ${result.id}`);
                return [
                    `Asked your human for: ${args.label}`,
                    `Request ID: ${result.id}`,
                    `Expires: ${result.expires_at}`,
                    result.next,
                ].join("\n");
            } catch (err) {
                if (err instanceof OneClawApiError) {
                    if (err.status === 403) throw new UserError(`Access denied: ${err.detail}`);
                    if (err.status === 400) throw new UserError(`Bad request: ${err.detail}`);
                }
                throw err;
            }
        },
    };
}

export function checkSecretRequestTool(client: OneClawClient) {
    return {
        name: "check_secret_request" as const,
        description:
            "Has your human answered a request_secret yet? Returns pending, fulfilled, " +
            "declined or expired. Once fulfilled you get the vault and path to read with " +
            "get_secret — never the value itself. You can only check your own requests.",
        parameters: z.object({
            request_id: z.string().describe("The id request_secret returned"),
        }),
        execute: async (args: { request_id: string }) => {
            try {
                const r = await client.getSecretRequest(args.request_id);
                const lines = [`Status: ${r.status}`];
                if (r.status === "fulfilled" && r.path) {
                    lines.push(`Stored at: ${r.path}`);
                    if (r.vault_id) lines.push(`Vault: ${r.vault_id}`);
                }
                lines.push(r.next);
                return lines.join("\n");
            } catch (err) {
                if (err instanceof OneClawApiError && err.status === 404) {
                    // Also what another agent's request looks like, deliberately.
                    throw new UserError(
                        "No such request. Check the id request_secret gave you — you can only " +
                            "look at your own.",
                    );
                }
                throw err;
            }
        },
    };
}
