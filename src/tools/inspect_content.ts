import { z } from "zod";
import {
  inspectInput,
  normalizeUnicode,
  type InspectionResult,
  type ThreatDetection,
} from "../security/index.js";

/** Structured result returned as JSON (tests + programmatic callers). */
function buildInspectContentReport(
  result: InspectionResult,
  unicode: { normalized: string; modified: boolean },
): {
  safe: boolean;
  verdict: "clean" | "malicious";
  threat_count: number;
  threats: ThreatDetection[];
  unicode_normalized?: boolean;
  normalized_content?: string;
} {
  const threats = result.threats;
  const malicious = threats.some(
    (t) =>
      t.type === "command_injection" ||
      t.type === "social_engineering" ||
      (t.type === "pii" && (t.pattern === "ssn" || t.severity === "critical")) ||
      (t.type === "network_threat" && t.severity === "critical"),
  );
  const verdict: "clean" | "malicious" = malicious ? "malicious" : "clean";
  const safe = !malicious && result.passed;

  const base = {
    safe,
    verdict,
    threat_count: threats.length,
    threats,
  };

  if (unicode.modified) {
    return {
      ...base,
      unicode_normalized: true,
      normalized_content: unicode.normalized,
    };
  }

  return base;
}

export function inspectContentTool() {
  return {
    name: "inspect_content" as const,
    description:
      "Inspect text content for security threats including command injection, encoding obfuscation, social engineering, and PII. Returns a JSON threat report (safe, verdict, threat_count, threats). Use before processing untrusted input.",
    parameters: z.object({
      content: z.string().describe("The text content to inspect for threats"),
      context: z
        .enum(["input", "output"])
        .optional()
        .describe("Whether this is model input or output (affects inspection context)"),
    }),
    execute: async (
      args: { content: string; context?: "input" | "output" },
      { log }: { log: { info: (msg: string) => void } },
    ): Promise<string> => {
      const context = args.context ?? "output";
      const unicode = normalizeUnicode(args.content);
      const result: InspectionResult = inspectInput("inspect_content", {
        content: args.content,
        context,
      });
      log.info(`inspection: ${result.threats.length} threat(s) detected`);

      const report = buildInspectContentReport(result, unicode);
      return JSON.stringify(report);
    },
  };
}
