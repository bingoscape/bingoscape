# syntax=docker.io/docker/dockerfile:1

FROM node:24-alpine AS base

# Install all dependencies (including dev) for the build and the migrator
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/main#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV SKIP_ENV_VALIDATION=1

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build:ci

# Migration image: drizzle-kit is a dev dependency, so this stage reuses the
# full node_modules and the runtime image can stay on the standalone output.
FROM base AS migrator
WORKDIR /app

ENV NODE_ENV=production
ENV SKIP_ENV_VALIDATION=1

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./package.json
COPY drizzle ./drizzle
COPY drizzle.config.prod.js ./drizzle.config.js
COPY src/server/db ./src/server/db

USER node

CMD ["node_modules/.bin/drizzle-kit", "migrate"]

# Production image: only the traced standalone output
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Create uploads directory with proper permissions
RUN mkdir -p /app/public/uploads && chown -R nextjs:nodejs /app/public/uploads

# OSRS Wiki image cache; docker-compose.yml mounts a host directory here
RUN mkdir -p /app/data/osrs-images && chown -R nextjs:nodejs /app/data
ENV OSRS_IMAGE_CACHE_DIR=/app/data/osrs-images

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000

# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/config/next-config-js/output
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
