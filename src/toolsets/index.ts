import type { ToolsetModule } from "./types.js";
import { vaultToolset } from "./vault.js";
import { approvalsToolset } from "./approvals.js";
import { intentsToolset } from "./intents.js";
import { executeToolset } from "./execute.js";
import { cardsToolset } from "./cards.js";
import { treasuryToolset } from "./treasury.js";
import { memoryToolset } from "./memory.js";
import { delegationToolset } from "./delegation.js";
import { channelsToolset } from "./channels.js";
import { chatToolset } from "./chat.js";
import { automationsToolset } from "./automations.js";
import { runtimesToolset } from "./runtimes.js";
import { directoryToolset } from "./directory.js";
import { notificationToolset } from "./notification.js";
import { adminToolset } from "./admin.js";
import { platformToolset } from "./platform.js";

/**
 * Every client-backed toolset, in registration order. `inspect` and `local`
 * are not here: their tools take no vault client and are registered by hand
 * in `index.ts`.
 */
export const TOOLSET_MODULES: readonly ToolsetModule[] = [
    vaultToolset,
    approvalsToolset,
    intentsToolset,
    executeToolset,
    cardsToolset,
    treasuryToolset,
    memoryToolset,
    delegationToolset,
    channelsToolset,
    chatToolset,
    automationsToolset,
    runtimesToolset,
    directoryToolset,
    notificationToolset,
    adminToolset,
    platformToolset,
];

export type { ToolsetModule, ToolFactory, ToolsetId } from "./types.js";
