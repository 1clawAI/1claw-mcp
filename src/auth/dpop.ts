/**
 * DPoP (Demonstration of Proof-of-Possession) manager for the MCP server.
 * Self-contained implementation using Node.js Web Crypto API (crypto.subtle).
 */
export class DPoPManager {
    private keyPair: CryptoKeyPair | null = null;
    private publicJwk: JsonWebKey | null = null;

    async init(): Promise<void> {
        this.keyPair = await crypto.subtle.generateKey(
            { name: "ECDSA", namedCurve: "P-256" },
            true,
            ["sign", "verify"],
        );
        this.publicJwk = await crypto.subtle.exportKey(
            "jwk",
            this.keyPair.publicKey,
        );
    }

    getPublicJwk(): JsonWebKey {
        if (!this.publicJwk) throw new Error("DPoPManager not initialized");
        return this.publicJwk;
    }

    async generateProof(method: string, url: string): Promise<string> {
        if (!this.keyPair || !this.publicJwk) {
            throw new Error("DPoPManager not initialized");
        }

        const header = {
            typ: "dpop+jwt",
            alg: "ES256",
            jwk: {
                kty: this.publicJwk.kty,
                crv: this.publicJwk.crv,
                x: this.publicJwk.x,
                y: this.publicJwk.y,
            },
        };

        const payload = {
            jti: crypto.randomUUID(),
            htm: method.toUpperCase(),
            htu: stripQuery(url),
            iat: Math.floor(Date.now() / 1000),
        };

        const headerB64 = base64url(JSON.stringify(header));
        const payloadB64 = base64url(JSON.stringify(payload));
        const signingInput = `${headerB64}.${payloadB64}`;

        const signature = await crypto.subtle.sign(
            { name: "ECDSA", hash: "SHA-256" },
            this.keyPair.privateKey,
            new TextEncoder().encode(signingInput),
        );

        return `${signingInput}.${base64urlFromBuffer(signature)}`;
    }
}

function stripQuery(url: string): string {
    try {
        const u = new URL(url);
        return `${u.protocol}//${u.host}${u.pathname}`;
    } catch {
        return url.split("?")[0];
    }
}

function base64url(str: string): string {
    return base64urlFromBuffer(new TextEncoder().encode(str).buffer as ArrayBuffer);
}

function base64urlFromBuffer(buf: ArrayBuffer): string {
    const bytes = new Uint8Array(buf);
    return Buffer.from(bytes).toString("base64url");
}
