FROM node:22-bookworm-slim AS build
WORKDIR /web
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY . .
# true mostra o "Simular pagamento" do Pix e os cartões de teste (ambiente simulado)
ARG VITE_TEST_MODE=false
ENV VITE_TEST_MODE=$VITE_TEST_MODE
RUN yarn build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /web/dist /usr/share/nginx/html
EXPOSE 80
