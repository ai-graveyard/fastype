# 贡献指南

感谢你愿意参与 FasType。

## 提交前

```bash
pnpm check   # typecheck + lint + test + build
```

四项都要通过。CI 跑的就是这条命令。

## 目录结构

```
app/                    Next.js App Router（只有一个页面）
components/
  ui/                   Shadcn 风格基础组件
  common/               跨工作区共用组件（配额警告横幅、颜色选择器等）
  providers/            偏好、样式、文档、AI 的 context
  editor/               CodeMirror 封装
  workbench/            工作台各区域
lib/
  markdown/             解析、消毒、字数、分页算法
  render/               小红书卡片样式与布局、公众号内联样式
  themes/               结构化主题配置
  ai/                   OpenAI 兼容客户端与错误分类
  storage/              带版本号的 localStorage 读写
  i18n/                 中英文文案
tests/                  Vitest 单元测试
src-tauri/              Tauri 桌面客户端外壳
docs/                   产品需求文档等长文档
```

`src-tauri/` 只是把 `pnpm build` 导出的 `out/` 装进原生窗口，不含业务逻辑。桌面版和网页版跑的是同一份前端产物，功能不做区分——不要把能力实现进 Rust 侧。打包说明见 [README](README.md#桌面客户端)。

## 项目的几条硬约束

改动请先确认没有违反这些前提，它们定义了 FasType 是什么：

1. **没有后端。** 不引入 Route Handler、Server Action、数据库、队列或对象存储。构建产物必须能在纯静态文件服务器上跑起来。
2. **单文档。** 界面里永远只有一篇正在处理的文档。不加文件树、多标签页或项目概念。
3. **内容与样式分离。** Markdown 是唯一的内容源，平台样式不写回正文。
4. **预览与导出复用同一套渲染配置。** 不允许出现「预览一套、导出另一套」的实现。
5. **AI 是可选的。** 没有 AI 配置时，编辑、预览和导出必须完整可用。AI 结果在用户确认前不得覆盖正文。
6. **API Key 不外泄。** 不写进日志、URL、埋点、导出文件或错误文案。
7. **文案全部走 i18n。** 业务组件里不出现硬编码的中英文，也不硬编码主题颜色。
8. **不引入第三方运行时脚本、远程字体和遥测。**

## 加一套主题

主题是结构化配置，加主题不需要碰渲染逻辑：

1. 往 `lib/themes/xhs.ts` 的 `XHS_THEMES` 或 `lib/themes/wechat.ts` 的 `WECHAT_THEMES` 里加一项。
2. 在 `lib/i18n/zh.ts` 和 `lib/i18n/en.ts` 里补上 `labelKey` 对应的名称。
3. 颜色用六位十六进制，`tests/settings.test.ts` 会校验这一点。

## 测试

纯计算逻辑（分页规则、错误分类、字数统计、存储版本迁移）必须有单元测试。涉及 DOM 的部分（Markdown 消毒、公众号内联样式、卡片拆分克隆）在 jsdom 下测。

新增的边界处理请连带补一条测试——特别是「不应该发生什么」这类，比如不裁切内容、不覆盖正文、不泄露 Key。

## 提交信息

用中文或英文都可以，说清楚改了什么、为什么改。

## 报告安全问题

请不要提公开 issue，见 [SECURITY.md](SECURITY.md)。
