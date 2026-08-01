# ================================
# Multi-stage build for production
# ================================

# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files (o glob leva o package-lock.json junto — o `npm ci` exige)
COPY package*.json ./
COPY tsconfig.json ./

# `npm ci` (nao `npm install`): instala EXATAMENTE o que esta no lock e falha se
# lock e package.json divergirem. Com `npm install` o Render resolvia os `^` do
# zero a cada build e trazia o que estivesse mais novo no dia — foi assim que o
# @supabase/supabase-js pulou de 2.39 pra 2.111 sem ninguem pedir.
RUN npm ci

# Copy source code
COPY src ./src

# Build TypeScript
RUN npm run build

# ================================
# Stage 2: Production
FROM node:22-alpine

WORKDIR /app

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Create logs directory
RUN mkdir -p /app/logs

# Run as non-root user
USER node

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["node", "dist/server.js"]
