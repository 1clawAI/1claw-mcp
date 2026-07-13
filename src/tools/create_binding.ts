import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawClient, OneClawApiError } from "../client.js";

const credentialSourceSchema = z
  .object({
    type: z.enum(["inline", "vault_ref"]).describe("Source type: 'inline' (store value) or 'vault_ref' (live pointer to an existing vault secret)"),
    value: z
      .record(z.unknown())
      .optional()
      .describe("For inline: the credential value object (e.g. { token: '...' })"),
    vault_id: z
      .string()
      .optional()
      .describe("For vault_ref: UUID of the vault containing the referenced secret"),
    path: z
      .string()
      .optional()
      .describe("For vault_ref: the secret path in the vault (always uses latest version)"),
  })
  .describe("Structured credential source. Use vault_ref to reference an existing secret that may rotate independently.");

/**
 * Create a binding for the current agent. Human-gated: the backend rejects
 * agent-authenticated callers (a human operator configures bindings). The
 * credential is stored server-side and never returned.
 */
export function createBindingTool(client: OneClawClient) {
  return {
    name: "create_binding" as const,
    description:
      "Create a binding (credential handle) for the current agent. Requires a human operator token — agents cannot create their own bindings. Supports two credential modes: inline (stored in __agent-keys) or vault_ref (live pointer to an existing vault secret, resolved at execution time).",
    parameters: z.object({
      name: z.string().describe("Binding name (alphanumeric, '-', '_'; 1-64 chars)"),
      binding_type: z
        .string()
        .default("http")
        .describe("Binding type: http, graphql, postgres, redis, smtp, s3, custom, ..."),
      config: z
        .record(z.unknown())
        .default({})
        .describe("Binding config (e.g. { base_url, auth_type, auth_header })"),
      guardrails: z
        .record(z.unknown())
        .optional()
        .describe("Optional guardrails (allowed_hosts, max_duration_ms, max_requests_per_minute)"),
      credential: z
        .record(z.unknown())
        .optional()
        .describe("Legacy: inline credential material (e.g. { token } or { value }). Prefer credential_source for new bindings."),
      credential_source: credentialSourceSchema.optional(),
    }),
    execute: async (args: {
      name: string;
      binding_type?: string;
      config?: Record<string, unknown>;
      guardrails?: Record<string, unknown>;
      credential?: Record<string, unknown>;
      credential_source?: { type: string; value?: Record<string, unknown>; vault_id?: string; path?: string };
    }) => {
      try {
        const agentId = client.agentId;
        if (!agentId) {
          throw new UserError("Agent ID not resolved. Ensure ONECLAW_AGENT_API_KEY is set.");
        }

        if (args.credential && args.credential_source) {
          throw new UserError("Cannot use both 'credential' and 'credential_source'. Choose one credential mode.");
        }

        const body: Record<string, unknown> = {
          name: args.name,
          binding_type: args.binding_type ?? "http",
          config: args.config ?? {},
          guardrails: args.guardrails,
        };

        if (args.credential_source) {
          body.credential_source = args.credential_source;
        } else if (args.credential) {
          body.credential = args.credential;
        }

        const res = await client.createBinding(agentId, body);
        return JSON.stringify(res, null, 2);
      } catch (err) {
        if (err instanceof OneClawApiError) {
          throw new UserError(err.message);
        }
        throw err;
      }
    },
  };
}
