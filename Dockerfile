FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:22-bookworm-slim AS prod-deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:22-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
ARG DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tierlistplus?schema=public
ENV DATABASE_URL=${DATABASE_URL}
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npx next build

FROM node:22-alpine AS migrate
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat
RUN addgroup -g 10001 -S appuser && adduser -S -D -H -u 10001 -G appuser appuser
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json ./package.json
RUN PRISMA_CLI_VERSION="$(node -p 'require("./package.json").dependencies.prisma')" \
  && npm install -g "prisma@${PRISMA_CLI_VERSION}" \
  && npm cache clean --force \
  && rm -rf /root/.npm /root/.cache
COPY --chown=appuser:appuser prisma ./prisma
COPY --chown=appuser:appuser prisma.config.migrate.ts ./prisma.config.migrate.ts
USER appuser
CMD ["prisma", "migrate", "deploy", "--config=prisma.config.migrate.ts", "--schema=prisma/schema.prisma"]

FROM node:22-bookworm-slim AS runner
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends gosu openssl && rm -rf /var/lib/apt/lists/*
RUN groupadd --gid 10001 appuser && useradd --uid 10001 --gid 10001 --home-dir /app --shell /usr/sbin/nologin --no-create-home appuser
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=builder --chown=appuser:appuser /app/.next/standalone ./
COPY --from=builder --chown=appuser:appuser /app/.next/static ./.next/static
COPY --from=builder --chown=appuser:appuser /app/public ./public
COPY --from=builder --chown=appuser:appuser /app/scripts/cleanup-orphan-uploads.mjs ./scripts/cleanup-orphan-uploads.mjs
COPY --from=prod-deps --chown=appuser:appuser /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appuser /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder --chown=appuser:appuser /app/node_modules/.prisma ./node_modules/.prisma
COPY --chmod=755 docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "server.js"]
