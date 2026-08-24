import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawClient, OneClawApiError } from "../client.js";

export function platformSiweChallengeTool(client: OneClawClient) {
  return {
    name: "platform_siwe_challenge" as const,
    description:
      "Issue a SIWE nonce for wallet-native platform user provisioning (plt_ auth required).",
    parameters: z.object({
      domain: z.string().optional().describe("Optional SIWE domain override"),
    }),
    execute: async (args: { domain?: string }) => {
      try {
        const result = await client.platformSiweChallenge(args);
        return JSON.stringify(result, null, 2);
      } catch (err) {
        if (err instanceof OneClawApiError) {
          throw new UserError(err.detail);
        }
        throw err;
      }
    },
  };
}

export function platformGetConnectionTool(client: OneClawClient) {
  return {
    name: "platform_get_connection" as const,
    description:
      "Get platform connection details including claim status and entitlement_status.",
    parameters: z.object({
      connection_id: z.string().uuid(),
    }),
    execute: async (args: { connection_id: string }) => {
      try {
        const result = await client.platformGetConnection(args.connection_id);
        return JSON.stringify(result, null, 2);
      } catch (err) {
        if (err instanceof OneClawApiError) {
          throw new UserError(err.detail);
        }
        throw err;
      }
    },
  };
}

export function platformConnectionUsageTool(client: OneClawClient) {
  return {
    name: "platform_connection_usage" as const,
    description:
      "Get per-connection LLM inference spend for the current UTC month.",
    parameters: z.object({
      connection_id: z.string().uuid(),
    }),
    execute: async (args: { connection_id: string }) => {
      try {
        const result = await client.platformGetConnectionUsage(args.connection_id);
        return JSON.stringify(result, null, 2);
      } catch (err) {
        if (err instanceof OneClawApiError) {
          throw new UserError(err.detail);
        }
        throw err;
      }
    },
  };
}

export function platformListEntitlementsTool(client: OneClawClient) {
  return {
    name: "platform_list_entitlements" as const,
    description: "List on-chain entitlement watch evaluations for a connection.",
    parameters: z.object({
      connection_id: z.string().uuid(),
    }),
    execute: async (args: { connection_id: string }) => {
      try {
        const result = await client.platformListEntitlements(args.connection_id);
        return JSON.stringify(result, null, 2);
      } catch (err) {
        if (err instanceof OneClawApiError) {
          throw new UserError(err.detail);
        }
        throw err;
      }
    },
  };
}

export function platformPreviewTemplateTool(client: OneClawClient) {
  return {
    name: "platform_preview_template" as const,
    description:
      "Preview resolved template spec with {{params.*}} and {{subject.*}} substitution.",
    parameters: z.object({
      app_id: z.string().uuid(),
      template_id: z.string().uuid(),
      parameters: z.record(z.unknown()).optional(),
      subject: z
        .object({
          user_id: z.string().optional(),
          external_subject: z.string().optional(),
          wallet_address: z.string().optional(),
          email: z.string().optional(),
        })
        .optional(),
    }),
    execute: async (args: {
      app_id: string;
      template_id: string;
      parameters?: Record<string, unknown>;
      subject?: Record<string, unknown>;
    }) => {
      try {
        const result = await client.platformPreviewTemplate(
          args.app_id,
          args.template_id,
          { parameters: args.parameters, subject: args.subject },
        );
        return JSON.stringify(result, null, 2);
      } catch (err) {
        if (err instanceof OneClawApiError) {
          throw new UserError(err.detail);
        }
        throw err;
      }
    },
  };
}
