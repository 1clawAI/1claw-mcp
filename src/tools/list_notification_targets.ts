import { z } from "zod";
import { OneClawClient, OneClawApiError } from "../client.js";

interface Target {
  id: string;
  target_type: string;
  config: Record<string, unknown>;
  events: string[];
  is_active: boolean;
  verified: boolean;
}

export function listNotificationTargetsTool(client: OneClawClient) {
  return {
    name: "list_notification_targets" as const,
    description:
      "List where this account's approvals and notifications are delivered — SMS, " +
      "webhook, email or push. Useful for telling a human why they did not hear " +
      "about a pending approval. Adding or verifying a target is a human action and " +
      "has no tool.",
    parameters: z.object({}),
    execute: async (
      _args: Record<string, never>,
      { log }: { log: { info: (msg: string) => void } },
    ) => {
      try {
        const result = (await client.listNotificationTargets()) as { targets?: Target[] };
        const targets = result.targets ?? [];
        log.info(`listed ${targets.length} notification target(s)`);

        if (targets.length === 0) {
          return "No notification targets configured. Approvals fall back to the account email and any registered mobile devices.";
        }

        return targets
          .map((t) => {
            const c = t.config ?? {};
            const destination =
              c.phone_number ?? c.url ?? c.email ?? c.push_token ?? "(unset)";
            const parts = [
              `Type: ${t.target_type}`,
              `Destination: ${destination}`,
              `Events: ${t.events.length === 0 ? "all" : t.events.join(", ")}`,
              `Active: ${t.is_active}`,
            ];
            if (t.target_type === "sms") {
              parts.push(
                t.verified
                  ? "Verified: yes — can approve tier-1 requests by reply"
                  : "Verified: no — receives notifications but cannot approve",
              );
            }
            return parts.join("\n");
          })
          .join("\n---\n");
      } catch (err) {
        if (err instanceof OneClawApiError && err.status === 403) {
          throw new Error(`Access denied: ${err.detail}`);
        }
        throw err;
      }
    },
  };
}
