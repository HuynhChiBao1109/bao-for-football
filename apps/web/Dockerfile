FROM node:22-alpine AS dependencies

WORKDIR /app

COPY package.json ./
RUN npm install --package-lock=false

FROM dependencies AS build

ARG VITE_API_BASE_URL=https://apifootball.b4f.site
ARG VITE_SOCKET_BASE_URL=https://apifootball.b4f.site
ARG VITE_SOCKET_PATH=/socket.io

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_SOCKET_BASE_URL=$VITE_SOCKET_BASE_URL
ENV VITE_SOCKET_PATH=$VITE_SOCKET_PATH

COPY index.html ./
COPY tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts ./
COPY public ./public
COPY src ./src

RUN npm run build

FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist

USER node

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD node -e "fetch('http://localhost:3000').then((response) => { if (!response.ok) process.exit(1) }).catch(() => process.exit(1))"

CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "3000"]
