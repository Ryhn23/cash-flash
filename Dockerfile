# syntax=docker/dockerfile:1

# ==========================================
# Base Toolchain Stage (Cached once)
# ==========================================
FROM node:22-bookworm-slim AS build-base
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# ==========================================
# Stage 1: Production Dependencies (100% cached on code changes)
# ==========================================
FROM build-base AS prod-deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --no-audit --no-fund

# ==========================================
# Stage 2: Build Frontend & Backend Bundles
# ==========================================
FROM build-base AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

COPY tsconfig.json vite.config.ts ./
COPY client/ ./client/
COPY server/ ./server/

RUN npm run build

# ==========================================
# Stage 3: Production Runtime (Ultra-Light)
# ==========================================
FROM node:22-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3001 \
    DATA_DIR=/app/data \
    UPLOAD_DIR=/app/uploads

# Create directories and set permissions on empty folders (CACHED, ~0.001s)
RUN mkdir -p /app/data /app/uploads && \
    chown -R node:node /app/data /app/uploads

# Copy cached production dependencies (100% CACHED across all code edits!)
COPY --chown=node:node --from=prod-deps /app/node_modules ./node_modules

# Copy only the compiled production dist artifacts (~1.5 MB, copies in milliseconds)
COPY --chown=node:node --from=builder /app/dist ./dist
COPY --chown=node:node package.json ./

USER node
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || 3001) + '/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "dist/server/index.js"]
