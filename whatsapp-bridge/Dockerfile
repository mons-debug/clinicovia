FROM node:24-alpine AS development
WORKDIR /app
RUN apk add --no-cache git
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
EXPOSE 3001
CMD ["npm", "run", "dev"]

FROM node:24-alpine AS builder
WORKDIR /app
RUN apk add --no-cache git
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 bridge && \
    adduser --system --uid 1001 bridge

RUN apk add --no-cache git
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist

USER bridge
EXPOSE 3001
CMD ["node", "dist/index.js"]
