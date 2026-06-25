FROM node:18-alpine

WORKDIR /app

COPY package.json ./

# Install dependencies
RUN npm install

COPY . .

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["npm", "run", "dev"]
