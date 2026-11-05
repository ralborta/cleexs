# Railway / Docker: solo @cleexs/api (Fastify)
FROM node:20-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

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
RUN npm run build --workspace=@cleexs/shared \
  && npm run build --workspace=@cleexs/api

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
