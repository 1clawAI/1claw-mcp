/**
 * Refuse to start on a Node too old to run this, and say so in a way that
 * can be acted on.
 *
 * `package.json` declares `engines: { node: ">=20" }`, and npm does not
 * enforce that — it prints a warning at install time and runs the code
 * anyway. So on Node 18 the process got as far as importing `undici`,
 * which touches the global `File` (added in Node 20), and died with:
 *
 *     ReferenceError: File is not defined
 *       at undici/lib/web/webidl/index.js:537
 *
 * An MCP client sees the process exit during the handshake and reports
 * "Server disconnected". Nothing in that tells anybody the problem is a
 * Node version, and the stack trace names a package the user has never
 * heard of and did not install.
 *
 * The reason this is common rather than rare: a GUI application on macOS
 * does not inherit a shell's PATH. It gets roughly
 * `/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin`, so `npx` resolves to
 * `/usr/local/bin/npx` and an old Node left there years ago by a
 * node.org installer — while the same command in a terminal picks up
 * nvm's or Homebrew's current Node and works perfectly. The user sees a
 * server that runs fine when they test it by hand and "fails" in the app.
 *
 * Imported first by `index.ts`, before anything that pulls in undici:
 * ESM evaluates imported modules in source order, so this runs while the
 * rest of the graph is still unevaluated. Keep it dependency-free.
 */

export const MINIMUM_NODE_MAJOR = 20;

/** The message a person can act on, given the version they are running. */
export function unsupportedNodeMessage(found: string, execPath?: string): string {
    const lines = [
        `@1claw/mcp requires Node ${MINIMUM_NODE_MAJOR} or newer — this is Node ${found}.`,
        "",
    ];
    if (execPath) lines.push(`  running: ${execPath}`);
    lines.push(
        "",
        "If this works in your terminal but not in your MCP client, the client is",
        "using a different Node. GUI apps on macOS do not inherit your shell PATH,",
        "so they find an old /usr/local/bin/node instead of the one nvm or Homebrew",
        "put on your PATH.",
        "",
        "Fix it by giving the client an absolute path. Run `which npx` in a terminal",
        "where `node --version` is 20 or newer, then set that full path as the",
        "command in your MCP server config — for example:",
        "",
        '  "command": "/opt/homebrew/bin/npx",',
        '  "args": ["-y", "@1claw/mcp"]',
        "",
        "Or upgrade the Node at /usr/local/bin.",
    );
    return lines.join("\n");
}

/** Parsed major version, or `null` when the string is not one we understand. */
export function majorVersion(version: string): number | null {
    const m = /^v?(\d+)\./.exec(version.trim());
    return m ? Number(m[1]) : null;
}

export function checkNodeVersion(
    version: string = process.versions.node,
    execPath?: string,
): { ok: true } | { ok: false; message: string } {
    const major = majorVersion(version);
    // An unparseable version is not a reason to refuse to run: a future
    // format we do not recognise should not brick the server.
    if (major === null || major >= MINIMUM_NODE_MAJOR) return { ok: true };
    return { ok: false, message: unsupportedNodeMessage(version, execPath) };
}

const result = checkNodeVersion(process.versions.node, process.execPath);
if (!result.ok) {
    // stderr, not stdout: stdout is the JSON-RPC transport and writing
    // prose there would corrupt the stream for a client that is listening.
    process.stderr.write(`${result.message}\n`);
    process.exit(1);
}
