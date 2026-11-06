# ==========================================
# Stage 1: Build Frontend, Server, and Native Addons
# ==========================================
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Install native addon build toolchain (for better-sqlite3)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package manifests
COPY package.json package-lock.json ./

# Install full dependencies
RUN npm ci

# Copy configuration and source files
COPY tsconfig.json vite.config.ts ./
COPY client/ ./client/
COPY server/ ./server/

# Build client (dist/client) and bundle server (dist/server/index.js)
RUN npm run build

# Prune devDependencies leaving only production node_modules with compiled native addons
RUN npm prune --omit=dev

# ==========================================
# Stage 2: Production Runtime (Slim, No Build Tools)
# ==========================================
FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3001 \
    DATA_DIR=/app/data \
    UPLOAD_DIR=/app/uploads

# Copy production node_modules (with pre-compiled native addons) and dist bundles
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./

# Create persistent storage directories and assign permissions to non-root 'node' user
RUN mkdir -p /app/data /app/uploads && \
    chown -R node:node /app

# Switch to non-root user
USER node

# Expose production port
EXPOSE 3001

# Container health probe using Node 22 native fetch
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || 3001) + '/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Start the optimized production server
CMD ["node", "dist/server/index.js"]
