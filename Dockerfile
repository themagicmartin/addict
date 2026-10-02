# Public demo image: onemore.sondersoftware.com
# Stage 1 assembles the single-file game, then splits its inline code into app.js/app.css
# so nginx can serve a strict CSP (see docker/nginx.conf).
FROM node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402 AS build
WORKDIR /src
COPY build.js index.html ./
COPY src ./src
COPY tools/split-for-csp.js ./tools/split-for-csp.js
RUN node build.js && node tools/split-for-csp.js

FROM nginxinc/nginx-unprivileged:1.28-alpine@sha256:7377697a821c131a924a7105fafbe7414db4e9fcc77a6f08f776f33f141ec3f8
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/dist/site/ /usr/share/nginx/html/
