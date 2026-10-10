FROM node:22-bookworm-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends default-jdk-headless ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src/ ./src/
COPY scripts/ ./scripts/
COPY migrations/ ./migrations/
COPY schemas/ ./schemas/
COPY --from=frontend /app/frontend/dist ./frontend/dist
USER node
EXPOSE 3000
CMD ["node", "src/server.js"]
