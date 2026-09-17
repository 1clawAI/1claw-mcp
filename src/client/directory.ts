import { ClientCore } from "./core.js";

/** directory domain of the vault API. Mixed into OneClawClient; never instantiated on its own. */
export class DirectoryApi extends ClientCore {
    // ── Directory job board (Feature 10) ──────────────────────────────

    async listDirectoryJobs(
        params: { tags?: string; q?: string; limit?: number } = {},
    ): Promise<Record<string, unknown>> {
        const qs = new URLSearchParams();
        if (params.tags) qs.set("tags", params.tags);
        if (params.q) qs.set("q", params.q);
        if (params.limit !== undefined) qs.set("limit", String(params.limit));
        const s = qs.toString();
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/directory/jobs${s ? `?${s}` : ""}`,
        );
    }

    async getDirectoryJob(jobId: string): Promise<Record<string, unknown>> {
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/directory/jobs/${jobId}`,
        );
    }

    async submitDirectoryJobBid(
        jobId: string,
        data: Record<string, unknown>,
    ): Promise<Record<string, unknown>> {
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/directory/jobs/${jobId}/bids`,
            { method: "POST", body: JSON.stringify(data) },
        );
    }


    // ── Org Directory ───────────────────────────────────────────────────

    async orgDirectory(params?: {
        q?: string;
        tags?: string;
        page?: number;
        page_size?: number;
    }): Promise<Record<string, unknown>> {
        const searchParams = new URLSearchParams();
        if (params?.q) searchParams.set("q", params.q);
        if (params?.tags) searchParams.set("tags", params.tags);
        if (params?.page) searchParams.set("page", String(params.page));
        if (params?.page_size) searchParams.set("page_size", String(params.page_size));
        const qs = searchParams.toString();
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/agents/org-directory${qs ? `?${qs}` : ""}`,
        );
    }

}
