import type { ToolsetModule } from "./types.js";
import { listChatConversationsTool } from "../tools/list_chat_conversations.js";
import { sendChatMessageTool } from "../tools/send_chat_message.js";

/** chat: opt-in. */
export const chatToolset: ToolsetModule = {
    id: "chat",
    gate: "opt-in",
    tools: [
        listChatConversationsTool,
        sendChatMessageTool,
    ],
};
