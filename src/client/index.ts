import { ClientCore } from "./core.js";
import { SecretsApi } from "./secrets.js";
import { IntentsApi } from "./intents.js";
import { CardsApi } from "./cards.js";
import { ApprovalsApi } from "./approvals.js";
import { PlatformApi } from "./platform.js";
import { DirectoryApi } from "./directory.js";
import { TreasuryApi } from "./treasury.js";
import { ExecuteApi } from "./execute.js";
import { MemoryApi } from "./memory.js";
import { AutomationsApi } from "./automations.js";
import { RuntimesApi } from "./runtimes.js";
import { ChatApi } from "./chat.js";
import { DelegationApi } from "./delegation.js";
import { AdminApi } from "./admin.js";

export {
    OneClawApiError,
    encodePath,
    type ClientConfig,
    type AgentCredentials,
    type AgentEntitlementsResponse,
    type AgentProfileResponse,
} from "./core.js";

/**
 * The vault client every tool receives. One class at the call site
 * (`client.listSecrets()`, `client.simulateTransaction()` …) assembled from
 * per-domain mixins so each domain's surface lives in its own file and a
 * later package split can leave whole domains out of the tree.
 */
export class OneClawClient extends ClientCore {}
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface OneClawClient extends SecretsApi, IntentsApi, CardsApi, ApprovalsApi, PlatformApi, DirectoryApi, TreasuryApi, ExecuteApi, MemoryApi, AutomationsApi, RuntimesApi, ChatApi, DelegationApi, AdminApi {}

/** Copy each mixin's own prototype methods onto the facade (TS handbook pattern). */
function applyMixins(target: { prototype: object }, mixins: Array<{ prototype: object }>): void {
    for (const mixin of mixins) {
        for (const name of Object.getOwnPropertyNames(mixin.prototype)) {
            if (name === "constructor") continue;
            const desc = Object.getOwnPropertyDescriptor(mixin.prototype, name);
            if (desc) Object.defineProperty(target.prototype, name, desc);
        }
    }
}
applyMixins(OneClawClient, [SecretsApi, IntentsApi, CardsApi, ApprovalsApi, PlatformApi, DirectoryApi, TreasuryApi, ExecuteApi, MemoryApi, AutomationsApi, RuntimesApi, ChatApi, DelegationApi, AdminApi]);

/** Every domain class, for the import-boundary test and Phase 3 packaging. */
export const CLIENT_DOMAINS = { secrets: SecretsApi, intents: IntentsApi, cards: CardsApi, approvals: ApprovalsApi, platform: PlatformApi, directory: DirectoryApi, treasury: TreasuryApi, execute: ExecuteApi, memory: MemoryApi, automations: AutomationsApi, runtimes: RuntimesApi, chat: ChatApi, delegation: DelegationApi, admin: AdminApi } as const;
