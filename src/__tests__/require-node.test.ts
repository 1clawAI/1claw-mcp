/**
 * The guard that turns "Server disconnected" into a sentence.
 *
 * Reported 2026-09-28: an MCP client showed `1claw … Failed … Server
 * disconnected` with no other detail. The server was fine — run from a
 * terminal it initialised in 8 seconds. The client was launching it with
 * `/usr/local/bin/node`, v18.16.0, left behind by an old node.org
 * installer; `@1claw/mcp` needs Node 20, npm does not enforce `engines`,
 * and undici's `File` reference killed the process during import.
 */

import { describe, it, expect } from "vitest";
import { checkNodeVersion, majorVersion, unsupportedNodeMessage, MINIMUM_NODE_MAJOR } from "../require-node.js";

describe("node version guard", () => {
    it("refuses the versions that actually crash", () => {
        // v18.16.0 is the one from the report.
        for (const v of ["18.16.0", "v18.16.0", "16.20.2", "14.21.3", "19.9.0"]) {
            const r = checkNodeVersion(v);
            expect(r.ok, `${v} should be refused`).toBe(false);
        }
    });

    it("allows every version that works", () => {
        for (const v of ["20.0.0", "20.11.1", "22.5.0", "24.10.0", "26.8.1"]) {
            expect(checkNodeVersion(v).ok, `${v} should run`).toBe(true);
        }
    });

    it("does not brick itself on a version string it cannot parse", () => {
        // A future format we do not recognise is not a reason to refuse to
        // start — that would turn a cosmetic surprise into an outage.
        for (const v of ["", "next", "v", "garbage"]) {
            expect(checkNodeVersion(v).ok).toBe(true);
        }
    });

    it("names the version, the binary, and the actual fix", () => {
        const r = checkNodeVersion("18.16.0", "/usr/local/bin/node");
        expect(r.ok).toBe(false);
        if (r.ok) return;
        // The three things someone needs to get unstuck, and which
        // "Server disconnected" gave them none of.
        expect(r.message).toContain("18.16.0");
        expect(r.message).toContain("/usr/local/bin/node");
        expect(r.message).toContain(String(MINIMUM_NODE_MAJOR));
        // Why it works in a terminal and not in the app — the part that
        // makes this look like a broken package rather than a PATH.
        expect(r.message).toMatch(/do not inherit your shell PATH/);
        // And something to paste.
        expect(r.message).toContain('"command"');
    });

    it("parses majors the way node reports them", () => {
        expect(majorVersion("v18.16.0")).toBe(18);
        expect(majorVersion("20.11.1")).toBe(20);
        expect(majorVersion("nonsense")).toBeNull();
    });

    it("the message is plain text, safe to put on stderr", () => {
        // stdout is the JSON-RPC transport; anything printed there corrupts
        // the stream. This must never be mistaken for a frame.
        const msg = unsupportedNodeMessage("18.16.0");
        expect(msg.trimStart().startsWith("{")).toBe(false);
        expect(() => JSON.parse(msg)).toThrow();
    });
});
