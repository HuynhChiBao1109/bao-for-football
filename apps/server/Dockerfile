FROM node:22-alpine AS dependencies

WORKDIR /app

# bcrypt can fall back to a native build when a prebuilt Alpine binary is unavailable.
RUN apk add --no-cache python3 make g++

COPY package.json ./
RUN npm install --package-lock=false

FROM dependencies AS build

COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src

RUN npm run build \
    && npm prune --omit=dev --package-lock=false --ignore-scripts

FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist

RUN mkdir -p uploads/image && chown -R node:node uploads

USER node

EXPOSE 3001

HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD node -e "fetch('http://localhost:3001/health').then((response) => { if (!response.ok) process.exit(1) }).catch(() => process.exit(1))"

CMD ["node", "dist/main.js"]
