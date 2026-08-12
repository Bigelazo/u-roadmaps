FROM node:18-alpine

WORKDIR /app

COPY package.json package-lock.json ./

# Install dependencies and generate the Prisma client.
RUN npm ci

COPY . .

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["sh", "-c", "npm run prisma:prepare && npm run dev"]
