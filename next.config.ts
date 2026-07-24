import type { NextConfig } from "next";

// FasType 是纯前端应用：静态导出，无 Route Handler / Server Action / 业务后端。
// 部署到 GitHub Pages 之类的子路径时，用 NEXT_PUBLIC_BASE_PATH 指定前缀。
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath: basePath || undefined,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
