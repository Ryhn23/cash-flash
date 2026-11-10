# ==========================================
# Stage 1: Base Toolchain (Cached)
# ==========================================
FROM node:22-bookworm-slim AS build-base
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# ==========================================
# Stage 2: Install Dependencies (Runs ONCE, 0 duplicate downloads)
# ==========================================
FROM build-base AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ==========================================
# Stage 3: Production Dependencies (Pruned locally, 100% cached on code changes)
# ==========================================
FROM deps AS prod-deps
WORKDIR /app
RUN npm prune --omit=dev

# ==========================================
# Stage 4: Build Client & Server Bundles
# ==========================================
FROM deps AS builder
WORKDIR /app

COPY tsconfig.json vite.config.ts ./
COPY client/ ./client/
COPY server/ ./server/

RUN npm run build

# ==========================================
# Stage 5: Minimal Production Runtime
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
