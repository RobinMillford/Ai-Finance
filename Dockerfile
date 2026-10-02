# ============================================================
# FinanceAI production image
# ============================================================

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

# ============================================================
# Build
# ============================================================
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Secret lifecycle: the image is built with NO provider credentials.
# All runtime secrets (DATABASE_URL, NEXTAUTH_SECRET, GROQ_API_KEY, etc.)
# are injected at container runtime via Docker Compose / environment config.
ENV NODE_ENV=production
RUN npm run build

# ============================================================
# Runtime
# ============================================================
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=10000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 financeai \
    && adduser --system --uid 1001 financeai

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.js ./next.config.js
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/drizzle ./drizzle
# Verification tooling (verify:postgres / verify:providers) executes lib/ at
# runtime via ts-node + tsconfig-paths, so lib/ must ship in the image.
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/tsconfig.json ./tsconfig.json

RUN chown -R financeai:financeai /app
USER financeai

EXPOSE 10000
CMD ["npm", "start"]
