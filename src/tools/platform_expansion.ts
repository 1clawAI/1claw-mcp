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

export function platformTransferOwnershipTool(client: OneClawClient) {
  return {
    name: "platform_transfer_ownership" as const,
    description:
      "Transfer a platform app to another organization (human JWT + X-Auth-Confirm step-up).",
    parameters: z.object({
      app_id: z.string().uuid(),
      target_org_id: z.string().uuid(),
      confirm_token: z.string().optional(),
    }),
    execute: async (args: {
      app_id: string;
      target_org_id: string;
      confirm_token?: string;
    }) => {
      try {
        const result = await client.platformTransferOwnership(
          args.app_id,
          { target_org_id: args.target_org_id },
          args.confirm_token,
        );
        return JSON.stringify(result, null, 2);
      } catch (err) {
        if (err instanceof OneClawApiError) throw new UserError(err.detail);
        throw err;
      }
    },
  };
}

export function platformDeleteAppTool(client: OneClawClient) {
  return {
    name: "platform_delete_app" as const,
    description:
      "Soft-delete a platform app and release its slug (returns deleted_at + slug).",
    parameters: z.object({ app_id: z.string().uuid() }),
    execute: async (args: { app_id: string }) => {
      try {
        const result = await client.platformDeleteApp(args.app_id);
        return JSON.stringify(result, null, 2);
      } catch (err) {
        if (err instanceof OneClawApiError) throw new UserError(err.detail);
        throw err;
      }
    },
  };
}

export function platformGetSpendPolicyTool(client: OneClawClient) {
  return {
    name: "platform_get_spend_policy" as const,
    description: "Get a platform app spend policy by ID.",
    parameters: z.object({
      app_id: z.string().uuid(),
      policy_id: z.string().uuid(),
    }),
    execute: async (args: { app_id: string; policy_id: string }) => {
      try {
        const result = await client.platformGetSpendPolicy(
          args.app_id,
          args.policy_id,
        );
        return JSON.stringify(result, null, 2);
      } catch (err) {
        if (err instanceof OneClawApiError) throw new UserError(err.detail);
        throw err;
      }
    },
  };
}

export function platformGetConnectionSpendPolicyTool(client: OneClawClient) {
  return {
    name: "platform_get_connection_spend_policy" as const,
    description: "Get effective spend policy for a platform connection (plt_ auth).",
    parameters: z.object({ connection_id: z.string().uuid() }),
    execute: async (args: { connection_id: string }) => {
      try {
        const result = await client.platformGetConnectionSpendPolicy(
          args.connection_id,
        );
        return JSON.stringify(result, null, 2);
      } catch (err) {
        if (err instanceof OneClawApiError) throw new UserError(err.detail);
        throw err;
      }
    },
  };
}

export function platformListConnectionApprovalsTool(client: OneClawClient) {
  return {
    name: "platform_list_connection_approvals" as const,
    description: "List human approvals for a platform connection (plt_ auth).",
    parameters: z.object({
      connection_id: z.string().uuid(),
      status: z.string().optional(),
      limit: z.number().int().optional(),
      offset: z.number().int().optional(),
    }),
    execute: async (args: {
      connection_id: string;
      status?: string;
      limit?: number;
      offset?: number;
    }) => {
      try {
        const result = await client.platformListConnectionApprovals(
          args.connection_id,
          args,
        );
        return JSON.stringify(result, null, 2);
      } catch (err) {
        if (err instanceof OneClawApiError) throw new UserError(err.detail);
        throw err;
      }
    },
  };
}

export function platformGetConnectionApprovalTool(client: OneClawClient) {
  return {
    name: "platform_get_connection_approval" as const,
    description: "Get a single approval for a platform connection (plt_ auth).",
    parameters: z.object({
      connection_id: z.string().uuid(),
      approval_id: z.string().uuid(),
    }),
    execute: async (args: { connection_id: string; approval_id: string }) => {
      try {
        const result = await client.platformGetConnectionApproval(
          args.connection_id,
          args.approval_id,
        );
        return JSON.stringify(result, null, 2);
      } catch (err) {
        if (err instanceof OneClawApiError) throw new UserError(err.detail);
        throw err;
      }
    },
  };
}

export function platformListConnectionPendingApprovalsTool(
  client: OneClawClient,
) {
  return {
    name: "platform_list_connection_pending_approvals" as const,
    description:
      "List consensus pending approvals for a connection with payload_hash (plt_ auth).",
    parameters: z.object({
      connection_id: z.string().uuid(),
      status: z.string().optional(),
      limit: z.number().int().optional(),
      offset: z.number().int().optional(),
    }),
    execute: async (args: {
      connection_id: string;
      status?: string;
      limit?: number;
      offset?: number;
    }) => {
      try {
        const result = await client.platformListConnectionPendingApprovals(
          args.connection_id,
          args,
        );
        return JSON.stringify(result, null, 2);
      } catch (err) {
        if (err instanceof OneClawApiError) throw new UserError(err.detail);
        throw err;
      }
    },
  };
}
