# Stage 1: 构建静态导出产物
FROM node:22-slim AS builder
WORKDIR /app

RUN npm install -g pnpm@11
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# Stage 2: 用 nginx 托管静态文件
FROM nginx:alpine AS runner

COPY --from=builder /app/out /usr/share/nginx/html
COPY deploy/nginx/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
