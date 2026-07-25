import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FasType",
    short_name: "FasType",
    description:
      "一个无需账号、没有后端的轻量 Markdown 写作工具：编辑、小红书图片排版、公众号排版和自带 Key 的轻量 AI。",
    start_url: "./",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    // 192 / 512 是各家「添加到主屏幕」的常见取值；少了它们只会拿到一个被拉伸的图标。
    // 路径保持相对，子路径部署（NEXT_PUBLIC_BASE_PATH）时不用另外处理。
    icons: [
      { src: "./icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "./fastype-logo.png", sizes: "256x256", type: "image/png", purpose: "any" },
      { src: "./icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
