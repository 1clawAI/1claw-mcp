import { z } from "zod";
import type { LocalDaemonClient } from "../local-client.js";

/**
 * MCP tool: proxy_request
 *
 * Executes an HTTP request with a secret injected by the daemon.
 * The AI model never sees the raw secret value — it specifies
 * which secret to use and where to send the request, and the
 * daemon handles injection per the policy rules.
 */
export function proxyRequestTool(client: LocalDaemonClient) {
    return {
        name: "proxy_request" as const,
        description:
            "Make an HTTP request with a secret injected by the local daemon. " +
            "The secret value is NEVER exposed — the daemon injects it per policy. " +
            "Requires a policy to be configured: `1claw daemon policy add <secret> --hosts <allowed_host>`.",
        parameters: z.object({
            secret_name: z
                .string()
                .min(1)
                .describe("Name of the secret to inject (e.g. 'STRIPE_KEY')"),
            url: z
                .string()
                .url()
                .describe("Target URL for the request"),
            method: z
                .enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"])
                .optional()
                .default("GET")
                .describe("HTTP method"),
            headers: z
                .record(z.string())
                .optional()
                .describe("Additional headers (secret is injected separately)"),
            body: z
                .string()
                .optional()
                .describe("Request body (for POST/PUT/PATCH)"),
        }),
        execute: async (
            args: {
                secret_name: string;
                url: string;
                method?: string;
                headers?: Record<string, string>;
                body?: string;
            },
            { log }: { log: { info: (msg: string) => void } },
        ) => {
            log.info(
                `proxy_request: ${args.method ?? "GET"} ${args.url} using secret "${args.secret_name}"`,
            );

            const result = await client.proxyRequest({
                secretName: args.secret_name,
                url: args.url,
                method: args.method,
                headers: args.headers,
                body: args.body,
            });

            return JSON.stringify({
                status: result.status,
                headers: result.headers,
                body: result.body,
            });
        },
    };
}
