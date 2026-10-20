/** The vault said no (or the network did). Dependency-free so the guard package can reference it. */
export class OneClawApiError extends Error {
    constructor(
        public status: number,
        public detail: string,
    ) {
        super(detail);
        this.name = "OneClawApiError";
    }
}

/**
 * A 202 from the vault that means "not yet: a human has to approve this".
 * `AppError::Accepted` (vault/src/error.rs) sends one of two bodies:
 *
 * - `{status: "awaiting_approval" | "approval_required", approval_id, transaction_id?, message}`:
 *   a human-in-the-loop approval. A transaction resumes with `resume_tx_id`
 *   once approved; a sign or execution request resumes server-side.
 * - `{status: "pending_approval", pending_approval_id, required_approvals, expires_at, message}`:
 *   a multi-party consensus gate. The same request is resubmitted with
 *   `approval_id` once the approval has executed.
 *
 * Read before the normal response shape, which these bodies do not have.
 */
export interface PendingApproval {
    kind: "approval" | "consensus";
    approvalId: string;
    transactionId?: string;
    requiredApprovals?: number;
    expiresAt?: string;
    message?: string;
}

export function pendingApprovalOf(body: unknown): PendingApproval | undefined {
    if (!body || typeof body !== "object") return undefined;
    const b = body as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : undefined);
    if (b.status === "pending_approval" && str(b.pending_approval_id)) {
        return {
            kind: "consensus",
            approvalId: str(b.pending_approval_id)!,
            requiredApprovals: typeof b.required_approvals === "number" ? b.required_approvals : undefined,
            expiresAt: str(b.expires_at),
            message: str(b.message),
        };
    }
    if ((b.status === "awaiting_approval" || b.status === "approval_required") && str(b.approval_id)) {
        return {
            kind: "approval",
            approvalId: str(b.approval_id)!,
            transactionId: str(b.transaction_id),
            message: str(b.message),
        };
    }
    return undefined;
}

/** Agent-facing text for a pending approval: what happened and what to call next. */
export function describePendingApproval(p: PendingApproval, toolName: string): string {
    const lines = [`Approval required: ${p.message ?? "a human must approve this request"}`];
    if (p.kind === "consensus") {
        lines.push(`Pending approval ID: ${p.approvalId}`);
        if (p.requiredApprovals !== undefined) lines.push(`Approvals required: ${p.requiredApprovals}`);
        if (p.expiresAt) lines.push(`Expires: ${p.expiresAt}`);
        lines.push(
            `Nothing was signed or sent. Once it is approved (check with list_pending_approvals), call ${toolName} again with the same arguments plus approval_id="${p.approvalId}".`,
        );
    } else {
        lines.push(`Approval ID: ${p.approvalId}`);
        if (p.transactionId) {
            lines.push(`Transaction ID: ${p.transactionId}`);
            lines.push(
                `Poll get_approval_status with this approval_id. Once approved, call ${toolName} again with resume_tx_id="${p.transactionId}" to sign and broadcast.`,
            );
        } else {
            lines.push(`Poll get_approval_status with this approval_id; a human decides in the 1Claw dashboard.`);
        }
    }
    return lines.join("\n");
}

/**
 * The vault refuses server signing for a self-custody key with a message
 * written for the owner ("sign ... with your passkey", domain/custody.rs).
 * An agent has no passkey; say what is true for it instead.
 */
export function forbiddenDetailForAgent(detail: string): string {
    if (/self-custody/i.test(detail)) {
        return (
            `${detail} For an agent: this key is a 2-of-3 self-custody key. An agent co-signs it only from inside a ` +
            `1Claw runtime the owner provisioned with a share (the runtime sidecar's /tss/send), and only once the ` +
            `owner has backed the key up. This MCP server cannot sign with it; ask the owner.`
        );
    }
    return detail;
}
