import { z } from "zod";
import { inspectInput, type InspectionResult } from "../security/index.js";

export function inspectContentTool() {
  return {
    name: "inspect_content" as const,
    description:
      "Inspect text content for security threats including command injection, encoding obfuscation, social engineering, and PII. Returns a threat report with severity levels. Use before processing untrusted input.",
    parameters: z.object({
      content: z.string().describe("The text content to inspect for threats"),
    }),
    execute: async (
      args: { content: string },
      { log }: { log: { info: (msg: string) => void } },
    ): Promise<string> => {
      const result: InspectionResult = inspectInput("inspect_content", { content: args.content });
      log.info(`inspection: ${result.threats.length} threat(s) detected`);

      if (result.passed && result.threats.length === 0) {
        return "No threats detected. Content appears safe.";
      }

      const lines: string[] = [
        result.passed ? "Content PASSED inspection (warnings below):" : "Content BLOCKED — threats detected:",
        "",
      ];

      for (const threat of result.threats) {
        lines.push(
          `[${threat.severity.toUpperCase()}] ${threat.type}: "${threat.pattern}"${threat.location ? ` (${threat.location})` : ""}`,
        );
      }

      if (result.sanitized && result.sanitized !== args.content) {
        lines.push("", "Sanitized version available (threats removed/neutralized).");
      }

      return lines.join("\n");
    },
  };
}
