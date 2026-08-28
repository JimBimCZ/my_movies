FROM node:24-slim AS deps
WORKDIR /app
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable pnpm
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# pnpm-workspace.yaml's allowBuilds: esbuild: true is a real, repo-committed approval, so
# copy it in — without it esbuild's scripts are also blocked here for no reason beyond a
# missing COPY. That leaves exactly one blocker: unrs-resolver (an eslint-only napi
# binding pulled in by eslint-config-next, never used by `next build`), which
# pnpm-workspace.yaml deliberately leaves unapproved rather than silenced (94f44b1 removed
# its `false` entry on purpose). Silencing it here would contradict that decision, so
# --ignore-scripts stays — it only needs to cover the one package the repo's own policy
# leaves pending, not the three the COPY line was accidentally hiding.
RUN pnpm install --frozen-lockfile --ignore-scripts

FROM node:24-slim AS builder
WORKDIR /app
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable pnpm
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN apt-get update && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/api/health" || exit 1

CMD ["node", "server.js"]
