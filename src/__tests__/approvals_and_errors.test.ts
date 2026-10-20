import { describe, it, expect } from "vitest";
import {
    pendingApprovalOf,
    describePendingApproval,
    forbiddenDetailForAgent,
} from "../client/error.js";
import { describeNonProblemBody } from "../client/core.js";
import { submitTransactionTool } from "../tools/submit_transaction.js";
import { signMessageTool } from "../tools/sign_message.js";
import type { OneClawClient } from "../client.js";

const log = { info: () => {} };

describe("pendingApprovalOf (AppError::Accepted bodies)", () => {
    it("reads a human-in-the-loop transaction approval", () => {
        const p = pendingApprovalOf({
            status: "awaiting_approval",
            transaction_id: "tx-1",
            approval_id: "ap-1",
            message: "Transaction requires human approval before signing",
        });
        expect(p).toMatchObject({ kind: "approval", approvalId: "ap-1", transactionId: "tx-1" });
        expect(describePendingApproval(p!, "submit_transaction")).toContain('resume_tx_id="tx-1"');
    });

    it("reads a consensus gate and tells the agent to resubmit with approval_id", () => {
        const p = pendingApprovalOf({
            status: "pending_approval",
            pending_approval_id: "pa-1",
            required_approvals: 2,
            expires_at: "2026-10-20T00:00:00Z",
        });
        expect(p).toMatchObject({ kind: "consensus", approvalId: "pa-1", requiredApprovals: 2 });
        expect(describePendingApproval(p!, "sign_message")).toContain('approval_id="pa-1"');
    });

    it("ignores ordinary responses", () => {
        expect(pendingApprovalOf({ id: "t", status: "broadcast" })).toBeUndefined();
        expect(pendingApprovalOf(undefined)).toBeUndefined();
    });
});

describe("tools surface a 202 instead of printing undefined fields", () => {
    it("submit_transaction", async () => {
        const client = {
            agentId: "agent-1",
            submitTransaction: async () => ({
                status: "awaiting_approval",
                transaction_id: "tx-9",
                approval_id: "ap-9",
                message: "Transaction requires human approval before signing",
            }),
        } as unknown as OneClawClient;
        const out = await submitTransactionTool(client).execute(
            { to: "0x1", value: "0.1", chain: "base" },
            { log },
        );
        expect(out).toContain("Approval ID: ap-9");
        expect(out).not.toContain("undefined");
    });

    it("sign_message passes approval_id through", async () => {
        let sent: Record<string, unknown> = {};
        const client = {
            agentId: "agent-1",
            signIntent: async (_id: string, body: Record<string, unknown>) => {
                sent = body;
                return { from: "0xabc", chain: "ethereum", signature: "0xsig" };
            },
        } as unknown as OneClawClient;
        await signMessageTool(client).execute(
            { message: "0x68", approval_id: "6f1c9a52-0000-4000-8000-000000000000" },
            { log },
        );
        expect(sent.approval_id).toBe("6f1c9a52-0000-4000-8000-000000000000");
    });
});

describe("error bodies", () => {
    it("builds a message from a guardrail denial with no detail", () => {
        const msg = describeNonProblemBody({
            error: "guardrail_violation",
            reason_code: "tx_max_value_exceeded",
            limit: "1.0",
            attempted: "2.0",
            approval_available: true,
        });
        expect(msg).toContain("tx_max_value_exceeded");
        expect(msg).toContain("limit: 1.0");
        expect(msg).toContain("attempted: 2.0");
    });

    it("rewrites the self-custody refusal for an agent", () => {
        const d = forbiddenDetailForAgent(
            "This key is customer-held (self-custody): 1claw holds one share or key of three and cannot sign with it alone. Sign through the self-custody path with your passkey.",
        );
        expect(d).toContain("runtime");
        expect(forbiddenDetailForAgent("Access denied.")).toBe("Access denied.");
    });
});
