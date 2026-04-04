FROM node:22-alpine AS base
WORKDIR /app
ENV PATH=/app/node_modules/.bin:$PATH

RUN corepack enable

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

FROM base AS api-dev
CMD ["sh", "-c", "yarn db:generate && yarn db:push && yarn dev:api"]

FROM base AS web-dev
CMD ["yarn", "dev:web"]

FROM base AS production
COPY . .
RUN yarn db:generate
RUN yarn build

EXPOSE 3000
CMD ["node", "apps/api/dist/server.js"]
