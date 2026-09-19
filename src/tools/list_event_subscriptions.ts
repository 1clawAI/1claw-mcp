import { z } from "zod";
import type { OneClawClient } from "../client.js";
import { OneClawApiError } from "../client/core.js";

interface Subscription {
  id: string;
  binding_id: string;
  event_type: string;
  interval_secs: number;
  is_active: boolean;
  primed: boolean;
  next_poll_at: string;
  last_error?: string | null;
  consecutive_errors: number;
  events_emitted: number;
}

export function listEventSubscriptionsTool(client: OneClawClient) {
  return {
    name: "list_event_subscriptions" as const,
    description:
      "List the connector event sources this agent is subscribed to (gmail.message.received, " +
      "stripe.invoice.created, drive.file.changed, …). 1Claw polls each source through the " +
      "installed binding and emits new items as automation events of that type; an automation " +
      "with trigger_type 'event' and a matching event_filter.event_type reacts to them. A human " +
      "creates subscriptions (POST /v1/agents/{id}/event-subscriptions); this only reads them.",
    parameters: z.object({
      agent_id: z.string().describe("Agent UUID (an agent may only read its own)"),
    }),
    execute: async (
      args: { agent_id: string },
      { log }: { log: { info: (msg: string) => void } },
    ) => {
      try {
        const result = (await client.listEventSubscriptions(args.agent_id)) as {
          subscriptions?: Subscription[];
        };
        const subs = result.subscriptions ?? [];
        log.info(`listed ${subs.length} event subscription(s)`);
        if (subs.length === 0) {
          return "No event subscriptions. Ask a human to subscribe an installed connector to one of its event_sources (see list_connector_presets).";
        }
        return subs
          .map((s) => {
            const state = !s.is_active ? "off" : s.primed ? "live" : "priming (first poll pending)";
            const err = s.consecutive_errors ? ` — ${s.consecutive_errors} error(s): ${s.last_error ?? ""}` : "";
            return `${s.event_type} every ${s.interval_secs}s [${state}] emitted=${s.events_emitted} next=${s.next_poll_at} (id ${s.id}, binding ${s.binding_id})${err}`;
          })
          .join("\n");
      } catch (e) {
        if (e instanceof OneClawApiError) return `Error: ${e.message}`;
        throw e;
      }
    },
  };
}
