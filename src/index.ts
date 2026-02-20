#!/usr/bin/env node

import http from "node:http";
import { FastMCP, UserError } from "fastmcp";
import { z } from "zod";
import { OneClawClient, OneClawApiError } from "./client.js";
import { listSecretsTool } from "./tools/list_secrets.js";
import { getSecretTool } from "./tools/get_secret.js";
import { putSecretTool } from "./tools/put_secret.js";
import { deleteSecretTool } from "./tools/delete_secret.js";
import { describeSecretTool } from "./tools/describe_secret.js";
import { createVaultTool } from "./tools/create_vault.js";
import { listVaultsTool } from "./tools/list_vaults.js";
import { grantAccessTool } from "./tools/grant_access.js";
import { shareSecretTool } from "./tools/share_secret.js";

type SessionAuth = { token: string; vaultId: string };

const baseUrl = process.env.ONECLAW_BASE_URL ?? "https://api.1claw.xyz";
const transport = process.env.MCP_TRANSPORT ?? "stdio";
const port = parseInt(process.env.PORT ?? "8080", 10);

// ── Shared client (stdio mode) ──────────────────────

let sharedClient: OneClawClient | undefined;

if (transport === "stdio") {
  const token = process.env.ONECLAW_AGENT_TOKEN;
  const vaultId = process.env.ONECLAW_VAULT_ID;
  if (!token) {
    console.error("ONECLAW_AGENT_TOKEN is required. Set it as an environment variable.");
    process.exit(1);
  }
  if (!vaultId) {
    console.error("ONECLAW_VAULT_ID is required. Set it as an environment variable.");
    process.exit(1);
  }
  sharedClient = new OneClawClient({ baseUrl, token, vaultId });
}

function resolveClient(session?: SessionAuth): OneClawClient {
  if (session) {
    return new OneClawClient({ baseUrl, token: session.token, vaultId: session.vaultId });
  }
  if (sharedClient) return sharedClient;
  throw new UserError("Not authenticated. Provide Authorization and X-Vault-ID headers.");
}

// ── Server setup ────────────────────────────────────

type ServerOpts = ConstructorParameters<typeof FastMCP<SessionAuth>>[0];

const serverOpts: ServerOpts = {
  name: "1claw",
  version: "0.1.0",
  health: { enabled: true, path: "/health" },
};

if (transport === "httpStream") {
  serverOpts.authenticate = (request: http.IncomingMessage): Promise<SessionAuth> => {
    const auth = (request.headers["authorization"] ?? "") as string;
    const token = auth.replace(/^Bearer\s+/i, "").trim();
    const vaultId = (request.headers["x-vault-id"] ?? "") as string;

    if (!token) return Promise.reject(new Error("Missing Authorization header (Bearer <agent-token>)"));
    if (!vaultId) return Promise.reject(new Error("Missing X-Vault-ID header"));

    return Promise.resolve({ token, vaultId });
  };
}

const server = new FastMCP<SessionAuth>(serverOpts);

// ── Tool registration helper ────────────────────────
// Each tool factory closes over a client. We intercept execute to
// resolve the correct per-session client at invocation time.

type AnyToolFactory = (client: OneClawClient) => {
  name: string;
  description: string;
  parameters: z.ZodTypeAny;
  execute: (args: never, ctx: never) => Promise<string>;
};

function registerTool(factory: AnyToolFactory) {
  const proto = factory(sharedClient ?? new OneClawClient({ baseUrl, token: "", vaultId: "" }));
  server.addTool({
    name: proto.name,
    description: proto.description,
    parameters: proto.parameters,
    execute: async (args: Record<string, unknown>, context: { session?: SessionAuth; log: { info: (msg: string) => void } }) => {
      const client = resolveClient(context.session);
      const tool = factory(client);
      return (tool.execute as (a: unknown, c: unknown) => Promise<string>)(args, context);
    },
  });
}

registerTool(listSecretsTool as AnyToolFactory);
registerTool(getSecretTool as AnyToolFactory);
registerTool(putSecretTool as AnyToolFactory);
registerTool(deleteSecretTool as AnyToolFactory);
registerTool(describeSecretTool as AnyToolFactory);
registerTool(createVaultTool as AnyToolFactory);
registerTool(listVaultsTool as AnyToolFactory);
registerTool(grantAccessTool as AnyToolFactory);
registerTool(shareSecretTool as AnyToolFactory);

// ── Stretch: rotate_and_store ────────────────────────

server.addTool({
  name: "rotate_and_store",
  description:
    "Store a new value for an existing secret (creating a new version) and return the version number. Useful when an agent has regenerated an API key and needs to persist it.",
  parameters: z.object({
    path: z.string().min(1).describe("Secret path to rotate"),
    value: z.string().min(1).describe("The new secret value"),
  }),
  execute: async (args, context) => {
    const client = resolveClient(context.session);
    const result = await client.putSecret(args.path, {
      value: args.value,
      type: "api_key",
    });
    context.log.info(`secret rotated: ${args.path}`);
    return `Rotated secret at '${args.path}'. New version: ${result.version}.`;
  },
});

// ── Stretch: get_env_bundle ──────────────────────────

server.addTool({
  name: "get_env_bundle",
  description:
    "Fetch a secret of type env_bundle, parse its KEY=VALUE lines, and return a structured JSON object. Useful for injecting environment variables into subprocesses.",
  parameters: z.object({
    path: z.string().min(1).describe("Path to an env_bundle secret"),
  }),
  execute: async (args, context) => {
    const client = resolveClient(context.session);
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
          throw new UserError(`No secret found at path '${args.path}'.`);
        }
      }
      throw err;
    }
  },
});

// ── Resource: browsable secret listing ───────────────

server.addResource({
  uri: "vault://secrets",
  name: "Vault secrets",
  description:
    "Browsable listing of all secret paths in the configured vault (metadata only, no values).",
  mimeType: "application/json",
  async load(auth?: SessionAuth) {
    const client = resolveClient(auth);
    const data = await client.listSecrets();
    return {
      text: JSON.stringify(
        data.secrets.map((s) => ({
          path: s.path,
          type: s.type,
          version: s.version,
          expires_at: s.expires_at,
        })),
        null,
        2,
      ),
    };
  },
});

// ── Start ────────────────────────────────────────────

if (transport === "httpStream") {
  server.start({
    transportType: "httpStream",
    httpStream: { port, host: "0.0.0.0" },
  });
  console.log(`1claw MCP server listening on port ${port} (HTTP streaming)`);
} else {
  server.start({ transportType: "stdio" });
}
