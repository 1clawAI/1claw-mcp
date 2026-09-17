import type { ToolsetModule } from "./types.js";
import { listNotificationTargetsTool } from "../tools/list_notification_targets.js";

/** notification: opt-in. */
export const notificationToolset: ToolsetModule = {
    id: "notification",
    gate: "opt-in",
    tools: [
        listNotificationTargetsTool,
    ],
};
