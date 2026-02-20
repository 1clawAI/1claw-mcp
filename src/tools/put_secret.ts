import { z } from "zod";
import { SECRET_TYPES } from "../types.js";
import type { OneClawClient } from "../client.js";

export function putSecretTool(client: OneClawClient) {
  return {
    name: "put_secret" as const,
    description:
      "Store a new secret or update an existing one in the 1claw vault. Provide the path, value, and type. Each call creates a new version. Supports optional expiry and max access count.",
    parameters: z.object({
      path: z
        .string()
        .min(1)
        .describe("Secret path, e.g. 'api-keys/stripe'"),
      value: z
        .string()
        .min(1)
        .describe("The secret value to store"),
      type: z
        .enum(SECRET_TYPES)
        .default("api_key")
        .describe("Secret type: api_key, password, private_key, certificate, file, note, ssh_key, or env_bundle"),
      metadata: z
        .record(z.unknown())
        .optional()
        .describe("Optional JSON metadata to attach to the secret"),
      expires_at: z
        .string()
        .optional()
        .describe("Optional ISO 8601 expiry datetime (e.g. '2025-12-31T23:59:59Z')"),
      max_access_count: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Optional maximum number of times the secret can be read before auto-expiring"),
    }),
    execute: async (args: {
      path: string;
      value: string;
      type: string;
      metadata?: Record<string, unknown>;
      expires_at?: string;
      max_access_count?: number;
    }, { log }: { log: { info: (msg: string) => void } }) => {
      const result = await client.putSecret(args.path, {
        value: args.value,
        type: args.type,
        metadata: args.metadata,
        expires_at: args.expires_at,
        max_access_count: args.max_access_count,
      });

      log.info(`secret stored: ${args.path}`);

      return `Secret stored at '${args.path}' (version ${result.version}, type: ${result.type}).`;
    },
  };
}
