FROM node:22-alpine AS deps
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile=false

FROM node:22-alpine AS builder
RUN corepack enable
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm prisma generate && pnpm build

FROM node:22-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app
RUN corepack enable
RUN addgroup --system app && adduser --system --ingroup app app
COPY --from=builder /app .
RUN mkdir -p uploads && chown -R app:app /app
USER app
EXPOSE 3000
CMD ["sh", "-c", "pnpm prisma db push && pnpm db:seed && pnpm start"]
