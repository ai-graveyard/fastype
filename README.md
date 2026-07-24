<p align="center">
  <img src="public/fastype-logo.png" alt="FasType logo" width="112" />
</p>

<h1 align="center">FasType</h1>

<p align="center">一篇 Markdown，写完就能带走。</p>

FasType 是一个**无需账号、没有后端**的轻量写作工具。一次只处理一篇 Markdown，帮你完成三件事：

- **写** —— 左预览、右源码的 Markdown 编辑器
- **排** —— 一份正文，同时生成小红书分页图片和微信公众号富文本
- **改** —— 填自己的 API Key，用自己的模型做轻量改写

所有数据都留在你的浏览器里。不使用 AI 时，正文不会离开这台设备。

**在线体验：[fast.lovtype.com](https://fast.lovtype.com)** —— 无需安装，打开即用。

## 截图

| 小红书 | 公众号 | 编辑器 |
| --- | --- | --- |
| ![小红书卡片预览与分页](public/screenshot-xhs.png) | ![公众号预览与复制](public/screenshot-gzh.png) | ![编辑器双栏视图](public/screenshot-bjq.png) |

## 快速开始

直接打开 [fast.lovtype.com](https://fast.lovtype.com) 就能用，没有登录页，也没有新手向导。

想在本地跑或参与开发：

```bash
pnpm install
pnpm dev
```

打开 http://localhost:3000 直接开始写。

## 功能

| 模块 | 能力 |
| --- | --- |
| 文档 | 新建、打开、拖入、3 秒自动保存、下载、单份本地草稿自动恢复 |
| 编辑器 | CodeMirror 6、语法高亮、格式工具栏、搜索替换、经典预览主题、预览长图下载、字数与光标统计 |
| 小红书 | “内容”编辑器支持文本 / 可编辑 Markdown 预览、7 种常用比例与自定义画布、7 套主题 + 可保存的自定义主题、元素级样式、页码/用户标识/二维码、自动分页、批量 PNG 导出（打包为 ZIP） |
| 公众号 | “内容”编辑器支持文本 / 可编辑 Markdown 预览、“封面”可制作 900×383 横版与 500×500 方形图、7 套主题 + 可保存的自定义主题、8 套标题模板、元素级排版、身份/引导卡片、内联 HTML 复制与下载 |
| AI | BYOK 配置、连接测试、润色/扩写/精简/自定义、流式输出、确认后才替换正文 |
| 界面 | 浅色 / 深色 / 跟随系统，简体中文 / English，平台成品预览可调分栏，内容编辑器支持源码 / Live Preview |

### 三个视图，一份正文

三个主视图共用同一份 Markdown 和同一套解析规则：

- **小红书 / 公众号** —— 左侧保持成品预览，右侧“内容”编辑器可在带行号的 Markdown 源码与无行号的可编辑预览之间切换
- **编辑器** —— 预览与源码双栏，默认 50% : 50%，可拖动分隔条调整比例，各视图独立记住自己的设置

### 预览即导出

小红书卡片默认以 1080×1440 的真实尺寸渲染（预览只是外层做了一层 CSS 缩放），导出 PNG 截取的就是这棵未缩放的 DOM，所以**预览看到什么，导出就是什么**——字体、颜色、分页、图片位置都不会走样。公众号同理：预览显示的 HTML 和「复制到公众号」写入剪贴板的 HTML 是同一份产物。

### 分页不会静默裁切

小红书长文自动分页。块尽量整体放置；标题不会孤零零留在页尾；实在放不下的列表、表格、代码块和长段落会按条目、行、句子拆开；既放不下又拆不开的内容会单独成页并明确提示，绝不悄悄裁掉。

## 静态部署

FasType 是纯前端应用，构建产物是一堆静态文件，任何静态文件服务器都能托管：

```bash
pnpm build      # 产物在 out/
```

| 平台 | 做法 |
| --- | --- |
| Cloudflare Pages / Netlify | 构建命令 `pnpm build`，输出目录 `out` |
| Vercel | 识别 Next.js 静态导出，无需额外配置 |
| GitHub Pages | 仓库子路径部署时需设置 `NEXT_PUBLIC_BASE_PATH` |
| 任意静态服务器 | 把 `out/` 整个目录扔上去即可 |

部署到 `https://user.github.io/fastype/` 这类子路径时：

```bash
NEXT_PUBLIC_BASE_PATH=/fastype pnpm build
```

运行时不需要 Node.js 服务、数据库、Redis、队列或对象存储。项目里没有 Route Handler，也没有 Server Action。

## AI：浏览器直连你自己的模型

在「设置 → AI」中填写：

- **Base URL** —— OpenAI 兼容的 Chat Completions 端点，通常需要包含 `/v1`
- **API Key**
- **模型名**

请求由**你的浏览器直接发往这个地址**，不经过任何 FasType 服务。你可以在浏览器网络面板里确认这一点。

### CORS：最常见的坑

浏览器发起的跨域请求需要目标服务放行。如果连接测试失败：

1. 先确认模型服务在运行、Base URL 没写错（漏掉 `/v1` 是最常见的错误）
2. 再检查服务端是否允许来自 FasType 站点来源的跨域请求

浏览器出于安全考虑不会告诉页面失败的具体原因，所以这两种情况的报错看起来是一样的，需要你逐个排除。

FasType **不提供**绕过 CORS 的后端代理——那会违背「没有后端」这个前提。可选方案：

- 在你的模型服务端配置 CORS 允许来源
- 使用本身支持浏览器直连的兼容服务
- 在本地跑 FasType，直连本地模型（例如 `http://localhost:11434/v1`）

### 混合内容

如果 FasType 部署在 HTTPS 上，浏览器会拦截它对 `http://` 接口的请求。要么换用 HTTPS 接口，要么在本地以 HTTP 运行 FasType。`localhost` 是例外，浏览器视其为安全来源。

## 数据边界

| 数据 | 存在哪 | 是否离开设备 |
| --- | --- | --- |
| Markdown 正文 | 浏览器 localStorage、你选择的本地文件 | 仅在你主动使用 AI 时，发送选中文本及少量上下文 |
| 小红书 / 公众号样式 | 浏览器 localStorage | 否 |
| 公众号封面设置与压缩裁剪图 | 浏览器 localStorage | 否 |
| API Key | 浏览器 localStorage | 仅随你主动发起的模型请求发往你填写的 Base URL |
| 远程图片 URL | Markdown 正文 | 浏览器会直接向图片来源站点请求 |
| 使用分析 | —— | 没有埋点，没有遥测 |

关于 API Key：

- 它只保存在当前浏览器的 localStorage 中。**这不等同于系统钥匙串加密**，共用设备请谨慎。
- 它不会出现在 URL、日志、错误提示、导出的图片或下载的文件里。
- 导出配置时默认**不包含** API Key，需要主动勾选才会带上。
- 设置里可以随时单独清除 AI 配置。

## 已知限制

- **远程图片导出**：把远程图片画进 canvas 需要图片来源站点允许跨域读取。不允许时导出的 PNG 里会缺这张图，界面会明确提示。FasType 不提供图片代理。
- **小红书导出**：导出全部页面时会把所有 PNG 打包成一个 ZIP，只触发一次下载；仍可单独导出当前图片。
- **公众号最终效果**：以粘贴到微信编辑器后的结果为准。表格、代码块和外部链接在公众号里各有限制，预览中会给出提示。
- **公众号封面原图**：只在当前裁剪窗口使用，不会保存；本地仅保存裁好的 WebP 结果，下载时再生成 900×383 与 500×500 PNG。
- **写回原文件**：依赖 File System Access API。授权后，编辑期间每 3 秒自动写回一次；不支持或未授权时仍会自动保存浏览器本地草稿，并可随时「下载 Markdown」。
- **localStorage**：容量有限。公众号封面会保存两张压缩后的本地裁剪图，其余图片二进制不会写入；写满时会停止自动保存并提示你立刻下载正文，不会覆盖最后一份可读数据。

## 开发

```bash
pnpm dev          # 开发服务器
pnpm build        # 静态导出到 out/
pnpm start        # 本地预览构建产物
pnpm typecheck    # TypeScript
pnpm lint         # ESLint
pnpm test         # Vitest
pnpm check        # 以上全部跑一遍
```

想参与开发？目录结构、硬约束和测试要求见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 技术栈

Next.js（App Router，静态导出）、React、TypeScript、Tailwind CSS、Shadcn/ui（基于 Radix UI）、Lucide、CodeMirror 6、marked、DOMPurify、html-to-image、jszip（批量导出打包）、qrcode、react-advanced-cropper（头像 / 封面裁剪）、gray-matter（小红书 Front Matter 解析）、sonner（轻提示）。

不引入第三方运行时脚本、远程字体和默认遥测。

## 许可证

[MIT](LICENSE)
