FROM node:22-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ src/
RUN npx tsc

RUN npm prune --production

# ── Runtime ───────────────────────────────────────────
FROM node:22-slim

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
