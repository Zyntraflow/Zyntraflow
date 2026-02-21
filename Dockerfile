FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY scripts/prepare-husky.mjs ./scripts/prepare-husky.mjs
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY scripts/prepare-husky.mjs ./scripts/prepare-husky.mjs
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY .env.operator.example ./.env.operator.example
CMD ["node", "dist/operator/operator.js"]
