import { z } from "zod";
import { UserError } from "fastmcp";
import { OneClawClient, OneClawApiError } from "../client.js";

export function listDelegationsTool(client: OneClawClient) {
  return {
    name: "list_delegations" as const,
    description:
      "List delegations configured for an agent (as delegator). Shows which agents it can delegate to and with what constraints.",
    parameters: z.object({
      agent_id: z
        .string()
        .optional()
        .describe(
          "Agent ID to list delegations for. Omit to use the current agent.",
        ),
    }),
    execute: async (
      args: { agent_id?: string },
      { log }: { log: { info: (msg: string) => void } },
    ) => {
      try {
        const agentId = args.agent_id || client.agentId;
        if (!agentId) {
          throw new UserError(
            "No agent_id provided and no agent ID configured on the client.",
          );
        }

        const result = await client.listDelegations(agentId);
        const delegations = (result as { delegations?: Record<string, unknown>[] }).delegations ?? [];
        log.info(`listed ${delegations.length} delegation(s)`);

        if (delegations.length === 0) return "No delegations found.";

        return (delegations as Record<string, unknown>[])
          .map((d) => {
            const parts = [
              `ID: ${d.id}`,
              `Delegate: ${d.delegate_name || d.delegate_id}`,
              `Mode: ${d.delegation_mode}`,
              `Active: ${d.is_active}`,
            ];
            if (Array.isArray(d.allowed_tools) && d.allowed_tools.length > 0)
              parts.push(`Allowed tools: ${d.allowed_tools.join(", ")}`);
            if (Array.isArray(d.blocked_tools) && d.blocked_tools.length > 0)
              parts.push(`Blocked tools: ${d.blocked_tools.join(", ")}`);
            if (d.max_daily_delegations != null)
              parts.push(`Daily limit: ${d.max_daily_delegations}`);
            if (d.delegations_today != null)
              parts.push(`Used today: ${d.delegations_today}`);
            if (d.max_depth != null) parts.push(`Max depth: ${d.max_depth}`);
            if (d.expires_at) parts.push(`Expires: ${d.expires_at}`);
            parts.push(`Created: ${d.created_at}`);
            return parts.join("\n");
          })
          .join("\n---\n");
      } catch (err) {
        if (err instanceof OneClawApiError) {
          if (err.status === 403) throw new UserError(`Access denied: ${err.detail}`);
          if (err.status === 404) throw new UserError("Agent not found.");
        }
        throw err;
      }
    },
  };
}

export function createDelegationTool(client: OneClawClient) {
  return {
    name: "create_delegation" as const,
    description:
      "Create a delegation granting an agent permission to delegate tasks to another agent. Human-scoped — agents cannot create their own delegations.",
    parameters: z.object({
      agent_id: z.string().min(1).describe("Delegator agent ID"),
      delegate_id: z.string().min(1).describe("Delegate (target) agent ID"),
      allowed_tools: z
        .array(z.string())
        .optional()
        .describe("List of tool names the delegate may use (empty = all)"),
      blocked_tools: z
        .array(z.string())
        .optional()
        .describe("List of tool names the delegate may NOT use"),
      max_daily_delegations: z
        .number()
        .optional()
        .describe("Max delegation calls per UTC day"),
      max_depth: z
        .number()
        .optional()
        .describe("Max delegation chain depth (default: 3)"),
      delegation_mode: z
        .enum(["caller", "target", "both"])
        .optional()
        .describe("Execution mode: caller, target, or both"),
      expires_at: z
        .string()
        .optional()
        .describe("ISO 8601 expiration timestamp"),
    }),
    execute: async (
      args: {
        agent_id: string;
        delegate_id: string;
        allowed_tools?: string[];
        blocked_tools?: string[];
        max_daily_delegations?: number;
        max_depth?: number;
        delegation_mode?: "caller" | "target" | "both";
        expires_at?: string;
      },
      { log }: { log: { info: (msg: string) => void } },
    ) => {
      try {
        const result = await client.createDelegation(args.agent_id, {
          delegate_id: args.delegate_id,
          allowed_tools: args.allowed_tools,
          blocked_tools: args.blocked_tools,
          max_daily_delegations: args.max_daily_delegations,
          max_depth: args.max_depth,
          delegation_mode: args.delegation_mode,
          expires_at: args.expires_at,
        });

        const d = result as Record<string, unknown>;
        log.info(`created delegation ${d.id}`);

        const parts = [
          `Delegation created: ${d.id}`,
          `Delegator: ${d.delegator_name || d.delegator_id}`,
          `Delegate: ${d.delegate_name || d.delegate_id}`,
          `Mode: ${d.delegation_mode}`,
          `Max depth: ${d.max_depth}`,
        ];
        if (d.max_daily_delegations != null)
          parts.push(`Daily limit: ${d.max_daily_delegations}`);
        if (d.expires_at) parts.push(`Expires: ${d.expires_at}`);

        return parts.join("\n");
      } catch (err) {
        if (err instanceof OneClawApiError) {
          if (err.status === 403) throw new UserError(`Access denied: ${err.detail}`);
          if (err.status === 409) throw new UserError(`Delegation already exists: ${err.detail}`);
        }
        throw err;
      }
    },
  };
}

export function getEffectiveDelegationsTool(client: OneClawClient) {
  return {
    name: "get_effective_delegations" as const,
    description:
      "Get effective delegations for the current agent — shows which agents it can delegate to, with daily usage and limits. Agent-scoped, auto-discovers agent ID.",
    parameters: z.object({}),
    execute: async (
      _args: Record<string, never>,
      { log }: { log: { info: (msg: string) => void } },
    ) => {
      try {
        const agentId = client.agentId;
        if (!agentId) {
          throw new UserError(
            "No agent ID configured. Set ONECLAW_AGENT_ID or use agent key auth.",
          );
        }

        const result = await client.getEffectiveDelegations(agentId);
        const delegations = (result as { delegations?: Record<string, unknown>[] }).delegations ?? [];
        log.info(`fetched ${delegations.length} effective delegation(s)`);

        if (delegations.length === 0)
          return "No delegations configured — you are not authorized to delegate to any agents.";

        return (delegations as Record<string, unknown>[])
          .map((d) => {
            const parts = [
              `Delegate: ${d.delegate_name || d.delegate_id}`,
              `Mode: ${d.delegation_mode}`,
            ];
            if (Array.isArray(d.allowed_tools) && d.allowed_tools.length > 0)
              parts.push(`Allowed tools: ${d.allowed_tools.join(", ")}`);
            if (Array.isArray(d.blocked_tools) && d.blocked_tools.length > 0)
              parts.push(`Blocked tools: ${d.blocked_tools.join(", ")}`);
            if (d.max_daily_delegations != null) {
              const remaining =
                (d.max_daily_delegations as number) -
                ((d.delegations_today as number) || 0);
              parts.push(
                `Daily: ${d.delegations_today || 0}/${d.max_daily_delegations} (${Math.max(0, remaining)} remaining)`,
              );
            }
            if (d.max_depth != null) parts.push(`Max depth: ${d.max_depth}`);
            if (d.expires_at) parts.push(`Expires: ${d.expires_at}`);
            return parts.join("\n");
          })
          .join("\n---\n");
      } catch (err) {
        if (err instanceof OneClawApiError) {
          if (err.status === 403) throw new UserError(`Access denied: ${err.detail}`);
        }
        throw err;
      }
    },
  };
}
