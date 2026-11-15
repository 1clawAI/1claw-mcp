/**
 * Fixed-window rate limiting for the hosted (httpStream) server.
 *
 * Where it is enforced matters more than how it counts. The limiter used to be
 * Hono middleware on `server.getApp()`, but fastmcp only consults that app for
 * requests mcp-proxy has already declined, so every POST /mcp went straight
 * past it (MCPRATE-P2). mcp-proxy calls `authenticate` on every POST to the
 * stream endpoint, so that is where the checks run (see server.ts).
 *
 * Two kinds of bucket share this code: per client IP for requests that fail
 * authentication, and per credential for requests that pass it. Hosted
 * connectors put many customers behind a few egress IPs, so a successful
 * request must never be charged to the IP.
 */

import { createHash, timingSafeEqual } from "node:crypto";
import type http from "node:http";

export interface RateLimitDecision {
    limited: boolean;
    limit: number;
    remaining: number;
    /** Unix seconds at which the current window ends. */
    resetAt: number;
    /** Seconds until the window ends (at least 1). */
    retryAfter: number;
}

export interface RateLimiter {
    readonly max: number;
    /** Count one request against `key` and say whether it is now over the limit. */
    hit(key: string): RateLimitDecision;
    /** Say whether `key` is already at the limit, without counting anything. */
    peek(key: string): RateLimitDecision;
    /** Stop the sweep timer (tests). */
    close(): void;
}

type HeaderGetter = (name: string) => string | string[] | undefined;

/** Constant-time string equality (length is not secret). */
function safeEqual(a: string, b: string): boolean {
    const ab = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * Client IP as the edge saw it.
 *
 * Hosted traffic (mcp.1claw.xyz / mcp.1claw.co) reaches us through the
 * dashboard's Vercel proxy, which `fetch`es Cloud Run. For those requests the
 * rightmost X-Forwarded-For entry is Vercel's egress IP, shared by every
 * customer (MCPRATEIP-P2). The proxy sends the real client IP in
 * `x-oneclaw-client-ip` together with `x-oneclaw-proxy-secret`, and strips any
 * caller-supplied copies of both. That header is trusted only when the secret
 * matches a non-empty `ONECLAW_PROXY_SECRET`, compared in constant time.
 *
 * Otherwise: the rightmost X-Forwarded-For entry is the one appended by the
 * proxy closest to us (Cloud Run's front end), so a client cannot choose it by
 * sending its own XFF; entries to its left are client-controlled. Falls back
 * to X-Real-IP, then the socket peer.
 */
export function clientIp(header: HeaderGetter, socketAddress?: string): string {
    const last = (v: string | string[] | undefined): string | undefined =>
        Array.isArray(v) ? v[v.length - 1] : v;
    const proxySecret = process.env.ONECLAW_PROXY_SECRET ?? "";
    if (proxySecret) {
        const presented = last(header("x-oneclaw-proxy-secret"));
        const trusted = last(header("x-oneclaw-client-ip"))?.trim();
        if (presented && trusted && safeEqual(presented, proxySecret)) return trusted;
    }
    const xff = last(header("x-forwarded-for"));
    const fromXff = xff ? xff.split(",").pop()?.trim() : undefined;
    return fromXff || last(header("x-real-ip"))?.trim() || socketAddress || "unknown";
}

export function clientIpOfRequest(request: http.IncomingMessage): string {
    return clientIp((n) => request.headers[n], request.socket?.remoteAddress);
}

/** Bucket key for a bearer credential. A hash, so no raw secret is held as a map key. */
export function credentialKey(credential: string): string {
    return createHash("sha256").update("mcp-rate-limit\u0000").update(credential).digest("hex");
}

/** Read a positive integer from the environment, else `fallback`. */
export function limitFromEnv(name: string, fallback: number): number {
    const n = parseInt(process.env[name] ?? "", 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function createRateLimiter(opts: { max: number; windowMs: number }): RateLimiter {
    const { max, windowMs } = opts;
    const buckets = new Map<string, { count: number; resetAt: number }>();

    const sweep = setInterval(() => {
        const now = Date.now();
        for (const [k, b] of buckets) if (now >= b.resetAt) buckets.delete(k);
    }, windowMs);
    if (typeof sweep === "object" && "unref" in sweep) sweep.unref();

    const decide = (count: number, resetAtMs: number, now: number, limited: boolean): RateLimitDecision => ({
        limited,
        limit: max,
        remaining: Math.max(0, max - count),
        resetAt: Math.ceil(resetAtMs / 1000),
        retryAfter: Math.max(1, Math.ceil((resetAtMs - now) / 1000)),
    });

    return {
        max,
        hit(key) {
            const now = Date.now();
            let b = buckets.get(key);
            if (!b || now >= b.resetAt) {
                b = { count: 0, resetAt: now + windowMs };
                buckets.set(key, b);
            }
            b.count++;
            return decide(b.count, b.resetAt, now, b.count > max);
        },
        peek(key) {
            const now = Date.now();
            const b = buckets.get(key);
            if (!b || now >= b.resetAt) return decide(0, now + windowMs, now, false);
            return decide(b.count, b.resetAt, now, b.count >= max);
        },
        close: () => clearInterval(sweep),
    };
}

/** Standard RateLimit-* headers for a decision, plus Retry-After when limited. */
export function rateLimitHeaders(d: RateLimitDecision): Record<string, string> {
    const h: Record<string, string> = {
        "RateLimit-Limit": String(d.limit),
        "RateLimit-Remaining": String(d.remaining),
        "RateLimit-Reset": String(d.resetAt),
    };
    if (d.limited) h["Retry-After"] = String(d.retryAfter);
    return h;
}

/**
 * The 429 to throw from `authenticate`. mcp-proxy writes a thrown Response
 * back verbatim (status, headers, body), so this is the reply the client sees.
 */
export function tooManyRequests(d: RateLimitDecision): Response {
    return new Response(
        JSON.stringify({
            error: { code: -32000, message: "Too many requests, please try again later." },
            id: null,
            jsonrpc: "2.0",
        }),
        {
            status: 429,
            statusText: "Too Many Requests",
            headers: { "Content-Type": "application/json", ...rateLimitHeaders(d) },
        },
    );
}
