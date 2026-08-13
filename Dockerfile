FROM node:24-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.14.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install dependencies and generate the Prisma client.
RUN pnpm install --frozen-lockfile

COPY . .

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["sh", "-c", "pnpm run prisma:prepare && pnpm run dev"]
