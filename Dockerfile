FROM node:22-alpine AS base
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run db:generate
RUN npm run build

EXPOSE 3000
CMD ["node", "apps/api/dist/server.js"]
