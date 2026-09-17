import type { ToolsetModule } from "./types.js";
import { createChannelTool } from "../tools/create_channel.js";
import { listChannelsTool } from "../tools/list_channels.js";
import { sendChannelMessageTool } from "../tools/send_channel_message.js";

/** channels: agent flag shroud_enabled. */
export const channelsToolset: ToolsetModule = {
    id: "channels",
    gate: "agent flag shroud_enabled",
    tools: [
        listChannelsTool,
        createChannelTool,
        sendChannelMessageTool,
    ],
};
