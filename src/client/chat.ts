import { ClientCore } from "./core.js";

/** chat domain of the vault API. Mixed into OneClawClient; never instantiated on its own. */
export class ChatApi extends ClientCore {
    // ── Chat ─────────────────────────────────────────────────────────

    async sendChatMessage(
        agentId: string,
        data: {
            message: string;
            conversation_id?: string;
            model?: string;
            provider?: string;
        },
    ): Promise<Record<string, unknown>> {
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/agents/${agentId}/chat`,
            {
                method: "POST",
                body: JSON.stringify(data),
            },
        );
    }

    async listChatConversations(
        agentId: string,
    ): Promise<Record<string, unknown>> {
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/agents/${agentId}/chat/conversations`,
        );
    }


    // ── Channels ─────────────────────────────────────────────────────

    async createChannel(
        agentId: string,
        data: {
            channel_type: string;
            channel_name?: string;
            config: Record<string, string>;
            slash_commands_enabled?: boolean;
            voice_transcription_enabled?: boolean;
            sender_allowlist?: string[];
            auto_respond_enabled?: boolean;
        },
    ): Promise<Record<string, unknown>> {
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/agents/${agentId}/channels`,
            {
                method: "POST",
                body: JSON.stringify(data),
            },
        );
    }

    async listChannels(
        agentId: string,
    ): Promise<Record<string, unknown>> {
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/agents/${agentId}/channels`,
        );
    }

    async sendChannelMessage(
        agentId: string,
        channelId: string,
        data: {
            external_chat_id: string;
            content: string;
        },
    ): Promise<Record<string, unknown>> {
        return this.request<Record<string, unknown>>(
            `${this.baseUrl}/v1/agents/${agentId}/channels/${channelId}/send`,
            {
                method: "POST",
                body: JSON.stringify(data),
            },
        );
    }

}
