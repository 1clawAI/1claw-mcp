import { z } from "zod";
import type { OneClawClient } from "../client.js";

export const rotateAndStoreTool = (client: OneClawClient) => ({
    name: "rotate_and_store",
    description:
        "Store a new value for an existing secret (creating a new version) and return the version number. Useful when an agent has regenerated an API key and needs to persist it.",
    parameters: z.object({
        path: z.string().min(1).describe("Secret path to rotate"),
        value: z.string().min(1).describe("The new secret value"),
        type: z.string().optional().describe("Secret type (api_key, password, etc.). Uses existing type if omitted."),
    }),
    execute: async (
        args: { path: string; value: string; type?: string },
        context: { log: { info: (msg: string) => void } },
    ) => {
        const result = await client.putSecret(args.path, {
            value: args.value,
            type: args.type ?? "api_key",
        });
        context.log.info(`secret rotated: ${args.path}`);
        return `Rotated secret at '${args.path}'. New version: ${result.version}.`;
    },
});

export const rotateGenerateTool = (client: OneClawClient) => ({
    name: "rotate_generate",
    description:
        "Server-side secret rotation: generates a cryptographically random value and stores it as a new version. The secret value never leaves the server. Returns the new version number.",
    parameters: z.object({
        path: z.string().min(1).describe("Secret path to rotate"),
        length: z.number().min(8).max(1024).optional().describe("Length of generated value (default 32)"),
        charset: z.enum(["hex", "base64", "alphanumeric", "ascii"]).optional().describe("Character set (default hex)"),
    }),
    execute: async (
        args: { path: string; length?: number; charset?: string },
        context: { log: { info: (msg: string) => void } },
    ) => {
        const result = await client.rotateGenerate(args.path, {
            length: args.length,
            charset: args.charset,
        });
        context.log.info(`secret rotated (server-generated): ${args.path}`);
        return `Rotated secret at '${args.path}' with server-generated value. New version: ${result.version}.`;
    },
});

export const listVersionsTool = (client: OneClawClient) => ({
    name: "list_versions",
    description:
        "List all versions of a secret at the given path. Returns version numbers, creation dates, and disabled status.",
    parameters: z.object({
        path: z.string().min(1).describe("Secret path"),
    }),
    execute: async (
        args: { path: string },
        context: { log: { info: (msg: string) => void } },
    ) => {
        const result = await client.listVersions(args.path);
        context.log.info(`listed versions: ${args.path}`);
        const versions = result.versions ?? [];
        if (versions.length === 0) return `No versions found for '${args.path}'.`;
        const lines = versions.map(
            (v) => `v${v.version} (${v.created_at})${v.is_disabled ? " [disabled]" : ""}`,
        );
        return `Versions for '${args.path}' (${versions.length} total):\n${lines.join("\n")}`;
    },
});
