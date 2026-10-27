# Imagem de produção da API (o Dockerfile da raiz é o de desenvolvimento).
# Contexto: a raiz do repositório.
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN yarn build && yarn install --frozen-lockfile --production

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY .docker/app/entrypoint.sh /entrypoint.sh
USER node
EXPOSE 3000
ENTRYPOINT ["/entrypoint.sh"]
