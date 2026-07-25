# AGENTS.md

面向在这个仓库里工作的 AI Agent 的说明。人类贡献者请看 [CONTRIBUTING.md](CONTRIBUTING.md)，这里的内容是它的子集加一些 Agent 专用的执行细节。

## 项目是什么

FasType 是一个**无需账号、没有后端**的纯前端 Markdown 写作工具（Next.js App Router，静态导出）。一次只处理一篇文档，做三件事：编辑 Markdown、排成小红书分页图片 / 微信公众号富文本、用用户自带的 API Key 做轻量 AI 改写。详见 [README.md](README.md)。

## 提交前必须跑通

```bash
pnpm check   # typecheck + lint + format:check + test + build，五项都要过
```

也可以单独跑：

```bash
pnpm typecheck      # TypeScript
pnpm lint           # ESLint
pnpm format:check   # Prettier（只查不改；`pnpm format` 直接改写）
pnpm test           # Vitest（jsdom 环境，tests/**/*.test.ts(x)）
pnpm build          # 静态导出到 out/
```

改动前先跑一次确认基线是绿的，改完再跑一次确认没有引入新问题。不要跳过 `pnpm check` 中的任何一步。

## 硬约束（改动前先自查，出自 CONTRIBUTING.md）

1. **没有后端。** 不引入 Route Handler、Server Action、数据库、队列或对象存储。产物必须能在纯静态文件服务器上跑。
2. **单文档。** 界面里永远只有一篇正在处理的文档，不加文件树、多标签页或项目概念。
3. **内容与样式分离。** Markdown 是唯一的内容源，平台样式（主题、排版）不写回正文。
4. **预览与导出复用同一套渲染配置。** 禁止「预览一套、导出另一套」的实现。
5. **AI 是可选的。** 没有 AI 配置时，编辑、预览、导出必须完整可用；AI 结果在用户确认前不得覆盖正文。
6. **API Key 不外泄。** 不写进日志、URL、埋点、导出文件或错误文案。
7. **文案全部走 i18n。** 业务组件里不出现硬编码的中英文字符串，也不硬编码主题颜色（颜色进 `lib/themes/`）。
8. **不引入第三方运行时脚本、远程字体和遥测。**

## 目录结构

```
app/                    Next.js App Router（只有一个页面）
components/
  ui/                   Shadcn 风格基础组件
  common/               跨工作区共用组件（设置卡片、配额警告横幅、颜色选择器等）
  providers/            偏好、样式、文档、AI 的 context
  editor/               CodeMirror 封装
  workbench/            工作台各区域（小红书 / 公众号 / 编辑器三视图）
lib/
  markdown/             解析、消毒、字数、分页算法、Front Matter 切分
  render/               小红书卡片样式与布局、公众号内联样式
  themes/               结构化主题配置（xhs.ts / wechat.ts）
  ai/                   OpenAI 兼容客户端与错误分类
  storage/              带版本号的 localStorage 读写
  i18n/                 中英文文案（zh.ts / en.ts）
  export/               PNG 导出
  file/                 File System Access API 封装
tests/                  Vitest 单元测试，与 lib/ 下的模块一一对应
src-tauri/              Tauri 桌面客户端外壳（只是把 out/ 装进原生窗口）
```

## 桌面客户端

`src-tauri/` 是一层薄壳：加载 `pnpm build` 导出的 `out/`，不含业务逻辑。改前端不需要动它。

- 不要把功能实现进 Rust 侧。桌面版和网页版必须是同一份前端产物，行为一致。
- `security.csp` 保持 `null`（Tauri 默认）。试过收紧成 `script-src/style-src 'self' 'unsafe-inline'`，结果 WKWebView 里 CodeMirror 的正文一个字都不渲染——只剩行号和布局，字数统计照常。要动 CSP 必须打包出来实机验证编辑器，不能只看网页版。
- macOS 和 Windows 的包都只能在对应系统上原生构建，交叉编译不可行；正式包走 `.github/workflows/desktop-release.yml`。
- `pnpm check` 不包含桌面构建。改了 `src-tauri/` 用 `pnpm desktop:build` 单独验证。

## 加一套主题（常见任务）

主题是结构化配置，不需要碰渲染逻辑：

1. 往 `lib/themes/xhs.ts` 的 `XHS_THEMES` 或 `lib/themes/wechat.ts` 的 `WECHAT_THEMES` 数组里加一项。
2. 在 `lib/i18n/zh.ts` 和 `lib/i18n/en.ts` 里补上对应 `labelKey` 的中英文名称。
3. 颜色用六位十六进制；`tests/settings.test.ts` 会校验这一点。

## 测试要求

- 纯计算逻辑（分页规则、错误分类、字数统计、存储版本迁移）必须有单元测试。
- 涉及 DOM 的部分（Markdown 消毒、公众号内联样式、卡片拆分克隆）在 jsdom 下测（`vitest.config.ts` 已配置 `environment: "jsdom"`）。
- 新增边界处理要连带补测试，尤其是「不应该发生什么」这类：不裁切内容、不覆盖正文、不泄露 API Key。
- 测试文件放在 `tests/`，命名与被测模块对应，例如改 `lib/markdown/paginate.ts` 就对应 `tests/paginate.test.ts`。

## 代码风格

- TypeScript `strict` 模式开启（见 `tsconfig.json`），不要用 `any` 绕过类型检查。
- 路径别名 `@/*` 指向仓库根目录。
- ESLint 用 `eslint-config-next`（core-web-vitals + typescript），提交前必须 `pnpm lint` 通过。
- 格式交给 Prettier（`printWidth: 100`，其余用默认值），不要手工排版；`*.md` 不归它管。
- 签名需要但用不上的参数用 `_` 前缀，ESLint 已按这个约定放行。
- 不要写解释代码在做什么的注释；只在有非显而易见的取舍或约束时才加注释。
- 不引入新的运行时依赖除非确有必要；这是一个刻意保持轻量、无后端的项目。

## 提交信息

中文或英文都可以，说清楚改了什么、为什么改。

## 安全问题

不要在改动或提交信息里包含真实的 API Key 或其他密钥。发现安全问题走 [SECURITY.md](SECURITY.md)，不要开公开 issue。
