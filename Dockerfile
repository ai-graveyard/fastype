# Stage 1: 构建静态导出产物
FROM node:22-slim AS builder
WORKDIR /app

ARG NEXT_PUBLIC_BASE_PATH=""
ENV NEXT_PUBLIC_BASE_PATH=${NEXT_PUBLIC_BASE_PATH}

RUN npm install -g pnpm@11
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
# 生产镜像本身也必须通过完整质量门禁，避免部署工作流和 CI 并行时先上线坏提交。
RUN pnpm check

# Stage 2: 用 nginx 托管静态文件
FROM nginx:alpine AS runner

# 每次部署重建都会让上一版镜像失去 tag 变成悬空镜像，不清理就是无上限的磁盘泄漏。
# 但服务器是和别的项目共用的，不能拿全局 docker image prune 去清。打上这个标签，
# Makefile 的 deploy 就能只清自己的那些（标签必须打在最终阶段，前面阶段的不会带过来）。
LABEL com.ai-graveyard.project=fastype

COPY --from=builder /app/out /usr/share/nginx/html
COPY deploy/nginx/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
