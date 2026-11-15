/**
 * MCPRATEIP-P2: hosted traffic arrives through the dashboard's Vercel proxy,
 * so the rightmost X-Forwarded-For is Vercel's shared egress IP. The proxy's
 * `x-oneclaw-client-ip` must decide the bucket, but only when it carries the
 * matching `x-oneclaw-proxy-secret`.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { clientIp, createRateLimiter } from "../core/rate-limit.js";

const SECRET = "test-proxy-secret-value";
const VERCEL_EGRESS = "10.0.0.0, 76.76.21.1";

function headers(h: Record<string, string>) {
    return (name: string) => h[name];
}

describe("clientIp trusts the dashboard proxy header only with the secret", () => {
    let saved: string | undefined;
    beforeEach(() => {
        saved = process.env.ONECLAW_PROXY_SECRET;
        process.env.ONECLAW_PROXY_SECRET = SECRET;
    });
    afterEach(() => {
        if (saved === undefined) delete process.env.ONECLAW_PROXY_SECRET;
        else process.env.ONECLAW_PROXY_SECRET = saved;
    });

    it("same rightmost XFF, different trusted client IPs: different buckets", () => {
        const a = clientIp(headers({
            "x-forwarded-for": VERCEL_EGRESS,
            "x-oneclaw-client-ip": "203.0.113.7",
            "x-oneclaw-proxy-secret": SECRET,
        }));
        const b = clientIp(headers({
            "x-forwarded-for": VERCEL_EGRESS,
            "x-oneclaw-client-ip": "198.51.100.9",
            "x-oneclaw-proxy-secret": SECRET,
        }));
        expect(a).toBe("203.0.113.7");
        expect(b).toBe("198.51.100.9");

        // One client exhausting its bucket does not limit the other.
        const limiter = createRateLimiter({ max: 2, windowMs: 60_000 });
        try {
            limiter.hit(a);
            limiter.hit(a);
            expect(limiter.hit(a).limited).toBe(true);
            expect(limiter.hit(b).limited).toBe(false);
        } finally {
            limiter.close();
        }
    });

    it("a wrong secret is ignored: falls back to rightmost XFF", () => {
        const ip = clientIp(headers({
            "x-forwarded-for": VERCEL_EGRESS,
            "x-oneclaw-client-ip": "203.0.113.7",
            "x-oneclaw-proxy-secret": "not-the-secret",
        }));
        expect(ip).toBe("76.76.21.1");
    });

    it("a secret of a different length is ignored without throwing", () => {
        const ip = clientIp(headers({
            "x-forwarded-for": VERCEL_EGRESS,
            "x-oneclaw-client-ip": "203.0.113.7",
            "x-oneclaw-proxy-secret": SECRET + "x",
        }));
        expect(ip).toBe("76.76.21.1");
    });

    it("a missing secret header is ignored", () => {
        const ip = clientIp(headers({
            "x-forwarded-for": VERCEL_EGRESS,
            "x-oneclaw-client-ip": "203.0.113.7",
        }));
        expect(ip).toBe("76.76.21.1");
    });

    it("with ONECLAW_PROXY_SECRET unset or empty, the header is never trusted", () => {
        for (const v of [undefined, ""]) {
            if (v === undefined) delete process.env.ONECLAW_PROXY_SECRET;
            else process.env.ONECLAW_PROXY_SECRET = v;
            const ip = clientIp(headers({
                "x-forwarded-for": VERCEL_EGRESS,
                "x-oneclaw-client-ip": "203.0.113.7",
                "x-oneclaw-proxy-secret": "",
            }));
            expect(ip).toBe("76.76.21.1");
        }
    });
});
