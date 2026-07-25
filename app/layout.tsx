import type { Metadata, Viewport } from "next";

import { THEME_INIT_SCRIPT } from "@/components/providers/theme-provider";

import "./globals.css";

const DESCRIPTION =
  "一个无需账号、没有后端的轻量 Markdown 写作工具：编辑、小红书图片排版、公众号排版和自带 Key 的轻量 AI。";

// 分享卡片里的图片地址必须是绝对地址。自部署时用 NEXT_PUBLIC_SITE_URL 覆盖。
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://fast.lovtype.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "FasType",
  description: DESCRIPTION,
  applicationName: "FasType",
  manifest: "./manifest.webmanifest",
  openGraph: {
    type: "website",
    siteName: "FasType",
    title: "FasType",
    description: DESCRIPTION,
    url: SITE_URL,
    locale: "zh_CN",
    images: [{ url: "/screenshot-xhs.png", width: 1463, height: 977, alt: "FasType 小红书图文排版预览" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "FasType",
    description: DESCRIPTION,
    images: ["/screenshot-xhs.png"],
  },
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
