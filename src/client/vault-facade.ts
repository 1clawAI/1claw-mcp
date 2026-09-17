import { ClientCore } from "./core.js";
import { SecretsApi } from "./secrets.js";
import { ApprovalsApi } from "./approvals.js";

/**
 * The client `@1claw/mcp-vault` ships: core (auth, exchange, request) plus
 * the secrets and approvals domains. No signing, execute, cards, memory,
 * platform or admin code is in its import closure — that is the package's
 * claim, and `packages/vault` builds only what this file reaches.
 */
export class VaultClient extends ClientCore {}
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface VaultClient extends SecretsApi, ApprovalsApi {}

function applyMixins(target: { prototype: object }, mixins: Array<{ prototype: object }>): void {
    for (const mixin of mixins) {
        for (const name of Object.getOwnPropertyNames(mixin.prototype)) {
            if (name === "constructor") continue;
            const desc = Object.getOwnPropertyDescriptor(mixin.prototype, name);
            if (desc) Object.defineProperty(target.prototype, name, desc);
        }
    }
}
applyMixins(VaultClient, [SecretsApi, ApprovalsApi]);
