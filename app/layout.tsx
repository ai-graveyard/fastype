import type { Metadata, Viewport } from "next";

import { THEME_INIT_SCRIPT } from "@/components/providers/theme-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: "FasType",
  description:
    "一个无需账号、没有后端的轻量 Markdown 写作工具：编辑、小红书图片排版、公众号排版和自带 Key 的轻量 AI。",
  applicationName: "FasType",
  manifest: "./manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // 主题由客户端根据 localStorage 决定，服务端产物必然不同，明确跳过水合警告。
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        {/* 首帧前同步应用主题，避免深色模式闪白（PRD FT-SET-003） */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex h-full flex-col overflow-hidden">{children}</body>
    </html>
  );
}
