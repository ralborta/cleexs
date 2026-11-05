# Railway: solo @cleexs/api (Fastify). No usar el Dockerfile de la raíz (ese es el web).
FROM node:20-bookworm-slim AS base
WORKDIR /app
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS=--max-old-space-size=4096

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
COPY prisma ./prisma
RUN npm ci --workspace=@cleexs/api --include-workspace-root

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.json ./
COPY apps/api ./apps/api
COPY packages/shared ./packages/shared
COPY prisma ./prisma
# Pasos separados para ver errores en logs de Railway
RUN npm run build --workspace=@cleexs/shared
RUN npm run build --workspace=@cleexs/api

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api ./apps/api
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/prisma ./prisma

EXPOSE 8080
CMD ["node", "apps/api/dist/index.js"]
