import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawClient, OneClawApiError } from "../client.js";

export function importSigningKeyTool(client: OneClawClient) {
    return {
        name: "import_signing_key" as const,
        description:
            "Import an existing private key as a signing key for an agent on a specific chain. Human-only. Requires password re-authentication via the password parameter. WARNING: The private key will be transmitted to the 1Claw vault for secure storage.",
        parameters: z.object({
            agent_id: z.string().optional().describe("Agent ID. Uses the current authenticated agent if omitted."),
            chain: z
                .enum(["ethereum", "bitcoin", "solana", "xrp", "cardano", "tron"])
                // Deliberately excludes midnight: derivation lives in the sidecar,
                // so there is no raw private key to import and the vault refuses
                // it before the consensus gate.
                .describe("Chain name"),
            private_key: z.string().describe("Private key to import"),
            format: z
                .enum(["hex", "base64", "wif"])
                .default("hex")
                .describe("Key format"),
            password: z.string().describe("Account password for re-authentication"),
        }),
        execute: async (
            args: { agent_id?: string; chain: string; private_key: string; format: string; password: string },
            { log }: { log: { info: (msg: string) => void } },
        ) => {
            const agentId = args.agent_id || client.agentId;
            if (!agentId) {
                throw new UserError(
                    "import_signing_key requires an agent_id parameter or agent authentication (ONECLAW_AGENT_API_KEY).",
                );
            }

            try {
                const res = await client.importSigningKey(agentId, args.chain, args.private_key, args.format, args.password);
                log.info(`signing key imported for ${args.chain}`);
                const address = (res as Record<string, unknown>).address ?? "N/A";
                return `Signing key imported for ${args.chain} on agent ${agentId}. Address: ${address}`;
            } catch (err) {
                if (err instanceof OneClawApiError) {
                    if (err.status === 400) throw new UserError(err.detail);
                    if (err.status === 401) throw new UserError(`Re-authentication failed: ${err.detail}`);
                    if (err.status === 403) throw new UserError(`Access denied: ${err.detail}`);
                    if (err.status === 409) throw new UserError(`Key already exists: ${err.detail}`);
                }
                throw err;
            }
        },
    };
}
