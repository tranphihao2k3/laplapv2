# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────
# Stage 1: Install dependencies
# ─────────────────────────────────────────────────────────────
FROM node:22.21.1-slim AS deps
WORKDIR /app

RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y \
      build-essential \
      node-gyp \
      pkg-config \
      python-is-python3 && \
    rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ─────────────────────────────────────────────────────────────
# Stage 2: Build Next.js (standalone)
# ─────────────────────────────────────────────────────────────
FROM deps AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

COPY . .
RUN npx next build

# ─────────────────────────────────────────────────────────────
# Stage 3: Production runtime
# ─────────────────────────────────────────────────────────────
FROM node:22.21.1-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y \
      ca-certificates \
      curl && \
    rm -rf /var/lib/apt/lists/* && \
    groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 nextjs

# Copy standalone output (Next.js tự sinh khi output: "standalone")
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsSL http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
