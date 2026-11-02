# ============================================================
# NOVIQ FRONTEND — Production Dockerfile
# Next.js 15 Multi-Stage Build
# ============================================================

# 1. Dependencies Stage
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package*.json ./
RUN npm ci

# 2. Builder Stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Disable telemetry and build the application
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

RUN npm run build

# 3. Runner Stage
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=4321
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy essential files and build output.
# --chown matters: everything above is owned by root, but the server below
# runs as `nextjs`. Without it, ISR/fetch-cache writes fail at runtime with
# EACCES ("Failed to update prerender cache") — pages still serve, but the
# logs fill with errors and revalidation cannot persist.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.mjs ./next.config.mjs

# `next start` re-reads next.config.mjs at boot, and that config hands
# next-intl the REQUEST-CONFIG path (./i18n.ts) plus the message
# dictionaries (./i18n/*.json). next-intl only stores the path, so the
# build survives without these — but any later change that makes it read
# the file would fail at runtime, after the image is already deployed.
# They are two tiny files: ship them.
COPY --from=builder /app/i18n.ts ./i18n.ts
COPY --from=builder /app/i18n ./i18n

USER nextjs

EXPOSE 4321

# Start Next.js production server on port 4321
CMD ["npm", "run", "start"]
