import { ClientCore } from "./core.js";
import type {
    ApprovalResponse,
} from "../types.js";

/** approvals domain of the vault API. Mixed into OneClawClient; never instantiated on its own. */
export class ApprovalsApi extends ClientCore {
    // ── Approvals ─────────────────────────────────────────

    async listApprovals(
        opts?: { status?: string; limit?: number },
    ): Promise<{ approvals: ApprovalResponse[] }> {
        const params = new URLSearchParams();
        if (opts?.status) params.set("status", opts.status);
        if (opts?.limit != null) params.set("limit", String(opts.limit));
        const qs = params.toString() ? `?${params.toString()}` : "";
        return this.request<{ approvals: ApprovalResponse[] }>(
            `${this.baseUrl}/v1/approvals${qs}`,
        );
    }

    async getApproval(approvalId: string): Promise<ApprovalResponse> {
        return this.request<ApprovalResponse>(
            `${this.baseUrl}/v1/approvals/${approvalId}`,
        );
    }

    async getApprovalStatus(
        approvalId: string,
    ): Promise<{ status: string; expires_at?: string | null }> {
        return this.request<{ status: string; expires_at?: string | null }>(
            `${this.baseUrl}/v1/approvals/${approvalId}/status`,
        );
    }

    async requestApproval(data: {
        action: string;
        target_type: string;
        target_id: string;
        summary: Record<string, unknown>;
        /** What the action will do; the enforced risk tier is derived from it. */
        payload?: Record<string, unknown>;
        reason?: string;
        /** Advisory — the server takes the higher of this and its own floor. */
        declared_risk_tier?: number;
        /** @deprecated Renamed to `declared_risk_tier`. Still accepted. */
        risk_tier?: number;
    }): Promise<ApprovalResponse> {
        return this.request<ApprovalResponse>(
            `${this.baseUrl}/v1/approvals/request`,
            { method: "POST", body: JSON.stringify(data) },
        );
    }


    // ── Pending Approvals (Consensus) ────────────────────────────────────

    async listPendingApprovals(
        params?: { status?: string; agent_id?: string },
    ): Promise<{ pending_approvals: Array<{ id: string; action: string; status: string; current_approvals: number; required_approvals: number; submitted_by: string; submitted_by_type: string; expires_at?: string }> }> {
        const qs = new URLSearchParams();
        if (params?.status) qs.set("status", params.status);
        if (params?.agent_id) qs.set("agent_id", params.agent_id);
        const q = qs.toString();
        return this.request(
            `${this.baseUrl}/v1/pending-approvals${q ? `?${q}` : ""}`,
        );
    }

    async approvePendingApproval(
        id: string,
        body: {
            decision: string;
            payload_hash: string;
            reason?: string;
            credential_type?: string;
        },
    ): Promise<unknown> {
        return this.request(
            `${this.baseUrl}/v1/pending-approvals/${id}/approve`,
            { method: "POST", body: JSON.stringify(body) },
        );
    }

    async executePendingApproval(id: string): Promise<unknown> {
        return this.request(
            `${this.baseUrl}/v1/pending-approvals/${id}/execute`,
            { method: "POST" },
        );
    }

}
