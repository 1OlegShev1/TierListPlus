FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

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
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json ./package.json
RUN PRISMA_CLI_VERSION="$(node -p 'require("./package.json").dependencies.prisma')" \
  && npm install -g "prisma@${PRISMA_CLI_VERSION}" \
  && npm cache clean --force \
  && rm -rf /root/.npm /root/.cache
COPY prisma ./prisma
CMD ["prisma", "migrate", "deploy", "--schema=prisma/schema.prisma"]

FROM node:22-bookworm-slim AS runner
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
