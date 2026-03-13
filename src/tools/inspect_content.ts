import { z } from "zod";
import {
    inspectInput,
    inspectOutput,
    normalizeUnicode,
    type ThreatDetection,
} from "../security/index.js";

export function inspectContentTool() {
    return {
        name: "inspect_content" as const,
        description:
            "Analyze text for security threats: prompt injection, command injection, " +
            "social engineering, encoding obfuscation, PII leakage, Unicode tricks, " +
            "and network/exfiltration patterns. Works without vault credentials. " +
            "Use this to check LLM outputs, user inputs, or any untrusted text before acting on it.",
        parameters: z.object({
            content: z.string().min(1).describe("The text to inspect for threats"),
            context: z
                .enum(["input", "output"])
                .default("output")
                .describe(
                    "'input' checks as if text is going TO a tool/model (includes exfil detection). " +
                    "'output' checks as if text came FROM a model (includes secret redaction).",
                ),
        }),
        execute: async (
            args: { content: string; context: "input" | "output" },
            ctx: { log: { info: (msg: string) => void } },
        ) => {
            const result =
                args.context === "input"
                    ? inspectInput("inspect_content", { content: args.content })
                    : inspectOutput("inspect_content", args.content);

            const { normalized, modified } = normalizeUnicode(args.content);

            const verdict = deriveVerdict(result.threats);

            const response: Record<string, unknown> = {
                verdict,
                safe: result.threats.length === 0,
                threat_count: result.threats.length,
                threats: result.threats.map(formatThreat),
                unicode_normalized: modified,
            };

            if (result.redacted) {
                response.redacted_content = result.redacted;
            }

            if (modified) {
                response.normalized_content = normalized;
            }

            ctx.log.info(
                `[inspect_content] ${verdict} — ${result.threats.length} threat(s) detected`,
            );

            return JSON.stringify(response, null, 2);
        },
    };
}

function deriveVerdict(threats: ThreatDetection[]): string {
    if (threats.length === 0) return "clean";
    const maxSeverity = threats.reduce((max, t) => {
        const rank = { low: 0, medium: 1, high: 2, critical: 3 } as const;
        return rank[t.severity] > rank[max] ? t.severity : max;
    }, "low" as ThreatDetection["severity"]);
    if (maxSeverity === "critical") return "malicious";
    if (maxSeverity === "high") return "suspicious";
    return "warning";
}

function formatThreat(t: ThreatDetection) {
    return {
        type: t.type,
        pattern: t.pattern,
        severity: t.severity,
        ...(t.location ? { match: t.location.slice(0, 80) } : {}),
    };
}
