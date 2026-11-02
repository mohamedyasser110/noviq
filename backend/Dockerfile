# ============================================================
# NOVIQ BACKEND — Production Dockerfile
# Node.js 20 Alpine with native build tools for better-sqlite3
#
# Railway: STORAGE_DIR is a mounted volume (SQLite + uploads). The
# entrypoint chowns it and drops to the non-root `node` user, because
# a Railway volume is created root-owned.
# ============================================================

FROM node:20-alpine AS base

# Install system dependencies required for native SQLite build (better-sqlite3),
# plus wget (healthcheck) and su-exec (privilege drop in the entrypoint).
RUN apk add --no-cache python3 make g++ sqlite-dev wget su-exec

WORKDIR /app

# Install production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application source code
COPY . .

# The agent event log follows STORAGE_DIR so it survives a redeploy; without
# this it lands in the image layer at /app and is lost on every new build.
ENV NODE_ENV=production \
    PORT=4322 \
    STORAGE_DIR=/app/storage \
    DB_PATH=/app/storage/noviq.db \
    UPLOADS_DIR=/app/storage/uploads

# Harden the runtime: no eval(), no new Function(), no runtime string→code.
# Nothing in this app or its dependency tree needs it (proved by
# scripts/security-sandbox.js, which boots and serves /api/health with the
# flag on), so the cheapest RCE payloads — a compromised dependency or an
# injected string calling eval — die at the first attempt instead of running.
#
# DISABLED in the image: enabling it here made the deployed container exit
# with no output at all (502, no logs) even though the same flag boots and
# serves fine locally, so something about the container image's start path
# depends on runtime codegen. Service first — investigate before re-arming.
# See scripts/security-sandbox.js and the security-posture test suite.
# ENV NODE_OPTIONS=--disallow-code-generation-from-strings

# Create the storage tree and hand it to the `node` user. On Railway the
# volume mount happens AFTER this layer and arrives root-owned, which is
# why docker-entrypoint.sh repeats the chown at boot.
RUN mkdir -p "$STORAGE_DIR/uploads" && chown -R node:node /app

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Expose backend API port
EXPOSE 4322

# Healthcheck to ensure API is responding
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:4322/api/health || exit 1

# Start production server (entrypoint chowns the volume, then execs this)
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "index.js"]
