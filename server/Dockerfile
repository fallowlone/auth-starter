FROM node:24-slim AS build
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY web/package.json web/
RUN npm ci -w server
COPY server server
RUN cd server && npx prisma generate && npm run build

FROM node:24-slim
WORKDIR /app/server
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/server/dist dist
COPY --from=build /app/server/prisma prisma
COPY --from=build /app/server/package.json .
EXPOSE 3000
USER node
CMD ["npm", "start"]
