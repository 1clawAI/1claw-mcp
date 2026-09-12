# Debian security updates are applied explicitly in the runtime stage below —
# a rebuild alone waits on upstream node:22-slim. Digest-pin with Renovate.
FROM node:22-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
# npm ci fails when lockfile was generated on another OS (optional platform bindings).
RUN npm install --include=dev

COPY tsconfig.json ./
COPY src/ src/
RUN npx tsc

RUN npm prune --production

# ── Runtime ───────────────────────────────────────────
FROM node:22-slim

# Apply Debian security updates, same as vault/Dockerfile's runtime stage.
#
# Rebuilding alone is not enough, which is what the comment at the top of this
# file assumed. A rebuild only picks up fixes once the upstream node:22-slim
# image itself is rebuilt against patched Debian packages, and that lag is what
# failed CI on 2026-09-12: node:22-slim carried libpcre2-8-0 10.42-1 with two
# HIGH CVEs (CVE-2026-86145 out-of-bounds write, CVE-2026-89161 memory
# corruption in pcre2_jit_match) while Debian had already shipped
# 10.42-1+deb12u1. The vault image scanned clean through the same Trivy gate
# because it does this; this one did not.
RUN apt-get update \
    && apt-get upgrade -y \
    && rm -rf /var/lib/apt/lists/*

# App runs `node` only; drop bundled npm so Trivy does not flag npm's transitive glob/minimatch tree.
RUN rm -rf /usr/local/lib/node_modules/npm \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules node_modules/
COPY --from=builder /app/dist dist/
COPY --from=builder /app/package.json ./

ENV MCP_TRANSPORT=httpStream
ENV PORT=8080
EXPOSE 8080

CMD ["node", "dist/index.js"]
