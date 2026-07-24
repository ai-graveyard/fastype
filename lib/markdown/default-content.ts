import type { Locale } from "@/lib/i18n";

/**
 * 首次访问和「清除全部本地数据」之后展示的默认内容（PRD FT-SET-002 / FT-SET-004）。
 * 按语言分别维护，且顺带演示常用 Markdown 语法，兼具教程和排版自检两个作用。
 */
const DEFAULT_DRAFT_FILENAME: Record<Locale, string> = {
  zh: "使用教程.md",
  en: "FasType Guide.md",
};

const DEFAULT_DRAFT_CONTENT: Record<Locale, string> = {
  zh: `# 欢迎使用 FasType

FasType 是一个纯前端的多平台 Markdown 排版工具：只写一份 Markdown，就能同时生成小红书图文、公众号文章，以及一份干净的 Markdown 预览。所有内容都只保存在这台设备的浏览器里，不会上传到任何服务器。

## 快速上手

1. 在编辑器里写 Markdown，左侧会实时生成对应平台的排版预览。
2. 点击顶部的「小红书 / 公众号 / 编辑器」切换不同平台的预览效果。
3. 在每个平台的设置面板里调整主题、字体、封面和用户标识。
4. 写完之后，用「下载 Markdown」保存原文，或直接导出图片、复制富文本到公众号编辑器。

## 常用格式示例

- **加粗**、*斜体*、~~删除线~~ 都能正常显示。
- 支持 [链接](https://github.com) 和行内代码 \`const x = 1\`。

> 引用块可以用来突出一句重要的话。

### 列表

- 无序列表第一项
- 无序列表第二项

1. 有序列表第一项
2. 有序列表第二项

- [x] 已完成的任务
- [ ] 还没做的任务

### 代码块

\`\`\`ts
function hello(name: string) {
  console.log(\`你好，\${name}\`);
}
\`\`\`

### 表格

| 功能 | 说明 |
| --- | --- |
| 小红书 | 自动分页排版，支持封面、主题和用户标识 |
| 公众号 | 一键复制富文本，直接粘贴进公众号编辑器 |
| AI 助手 | 配置自己的模型 Key 后，一键去 AI 味 / 去敏感词 |

## 关于本地数据

FasType 不需要注册登录，正文、样式和 AI 配置都只保存在浏览器的 localStorage 里：

- 关闭页面或刷新后，上次的草稿会自动恢复。
- 在「设置 → 本地数据」里可以清除草稿、样式或全部数据；清除之后会重新回到这篇教程。

现在可以清空这篇教程，开始写你自己的内容。
`,
  en: `# Welcome to FasType

FasType is a fully client-side Markdown tool for multi-platform publishing: write once in Markdown and get ready-to-publish layouts for Xiaohongshu and WeChat, plus a clean Markdown preview. Everything stays in this browser — nothing is uploaded to any server.

## Quick start

1. Write Markdown in the editor; the preview updates live for the current platform.
2. Use the "Xiaohongshu / WeChat / Editor" switcher at the top to preview each platform.
3. Open each platform's settings panel to adjust theme, typography, cover, and your profile badge.
4. When you're done, download the Markdown source, export images, or copy rich text straight into the WeChat editor.

## Formatting cheatsheet

- **Bold**, *italic*, and ~~strikethrough~~ all render correctly.
- Links like [FasType on GitHub](https://github.com) and inline code such as \`const x = 1\` work too.

> Blockquotes are a good way to highlight a key sentence.

### Lists

- First bullet
- Second bullet

1. First numbered item
2. Second numbered item

- [x] Done task
- [ ] Pending task

### Code block

\`\`\`ts
function hello(name: string) {
  console.log(\`Hello, \${name}\`);
}
\`\`\`

### Table

| Feature | What it does |
| --- | --- |
| Xiaohongshu | Auto-paginated cards with covers, themes, and profile badges |
| WeChat | One-click copy of rich text straight into the WeChat editor |
| AI assistant | Bring your own API key to humanize text or soften sensitive wording |

## About your local data

FasType has no account system. Your draft, styles, and AI settings are stored only in this browser's localStorage:

- Reopening or refreshing the page restores your last draft automatically.
- Settings → Local Data lets you clear the draft, styles, or everything; clearing brings back this tutorial.

Feel free to clear this tutorial and start writing your own content.
`,
};

export function getDefaultDraftFilename(locale: Locale): string {
  return DEFAULT_DRAFT_FILENAME[locale] ?? DEFAULT_DRAFT_FILENAME.zh;
}

export function getDefaultDraftContent(locale: Locale): string {
  return DEFAULT_DRAFT_CONTENT[locale] ?? DEFAULT_DRAFT_CONTENT.zh;
}
