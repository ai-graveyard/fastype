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
    icons: [
      {
        src: "./fastype-logo.png",
        sizes: "256x256",
        type: "image/png",
      },
    ],
  };
}
