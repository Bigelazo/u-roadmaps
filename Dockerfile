FROM node:24-alpine AS base

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

RUN corepack enable && corepack prepare pnpm@11.14.0 --activate

FROM base AS dependencies

# Prisma generates its client during postinstall, so its schema must be present
# before installing dependencies.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml prisma.config.ts ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

FROM dependencies AS build

COPY . .
# Next evaluates route modules while collecting build metadata. This URL is never
# contacted during the build; Compose provides the real value at runtime.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
RUN pnpm build

FROM dependencies AS migrate

COPY . .
CMD ["pnpm", "prisma", "migrate", "deploy"]

FROM base AS runner

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=build --chown=nextjs:nodejs /app ./
RUN mkdir /app/uploads && chown nextjs:nodejs /app/uploads

USER nextjs

EXPOSE 3000

CMD ["pnpm", "start"]
