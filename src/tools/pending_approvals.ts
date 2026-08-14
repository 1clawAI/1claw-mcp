import { z } from "zod";
import type { OneClawClient } from "../client.js";

export function listPendingApprovalsTool(client: OneClawClient) {
    return {
        name: "list_pending_approvals" as const,
        description:
            "List pending approvals for consensus-gated actions. Filter by status (pending, approved, rejected, executed, expired, cancelled) " +
            "or by agent_id to see a specific agent's pending items.",
        parameters: z.object({
            status: z.string().optional().describe("Filter by status"),
            agent_id: z.string().uuid().optional().describe("Filter by agent ID"),
        }),
        execute: async (
            args: { status?: string; agent_id?: string },
            { log }: { log: { info: (msg: string) => void } },
        ) => {
            const res = await client.listPendingApprovals(args);
            log.info(`listed ${res.pending_approvals.length} pending approvals`);
            if (!res.pending_approvals.length) return "No pending approvals found.";
            return JSON.stringify(
                res.pending_approvals.map((a) => ({
                    id: a.id,
                    action: a.action,
                    status: a.status,
                    approvals: `${a.current_approvals}/${a.required_approvals}`,
                    submitted_by: `${a.submitted_by_type}:${a.submitted_by}`,
                    expires_at: a.expires_at,
                })),
                null,
                2,
            );
        },
    };
}

export function approvePendingApprovalTool(client: OneClawClient) {
    return {
        name: "approve_pending_approval" as const,
        description:
            "Approve or reject a pending approval. Requires the payload_hash (SHA-256 of the action payload) to prevent tampering.",
        parameters: z.object({
            id: z.string().uuid().describe("Pending approval ID"),
            decision: z.enum(["approve", "reject"]).describe("Decision: approve or reject"),
            payload_hash: z.string().describe("SHA-256 hash of the action payload for integrity verification"),
            reason: z.string().optional().describe("Reason for the decision"),
        }),
        execute: async (
            args: { id: string; decision: "approve" | "reject"; payload_hash: string; reason?: string },
            { log }: { log: { info: (msg: string) => void } },
        ) => {
            await client.approvePendingApproval(args.id, {
                decision: args.decision,
                payload_hash: args.payload_hash,
                reason: args.reason,
            });
            log.info(`${args.decision}d pending approval ${args.id}`);
            return `Pending approval ${args.id} ${args.decision}d.`;
        },
    };
}

export function executePendingApprovalTool(client: OneClawClient) {
    return {
        name: "execute_pending_approval" as const,
        description:
            "Execute an approved pending approval. The action described in the approval payload will be carried out.",
        parameters: z.object({
            id: z.string().uuid().describe("Pending approval ID (must be in 'approved' status)"),
        }),
        execute: async (
            args: { id: string },
            { log }: { log: { info: (msg: string) => void } },
        ) => {
            await client.executePendingApproval(args.id);
            log.info(`executed pending approval ${args.id}`);
            return `Pending approval ${args.id} executed.`;
        },
    };
}
