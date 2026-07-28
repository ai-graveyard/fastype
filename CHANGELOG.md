# 更新日志

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

推 `v*` 标签会触发 `.github/workflows/desktop-release.yml` 构建桌面安装包，发版前请把 Unreleased 里的条目归到对应版本下。

## [Unreleased]

### 新增

- 编辑器视图的源码与预览按块级元素的源码行号双向滚动同步，写长文时两边不再各滚各的
- 预览工具栏加「复制带格式」：样式内联进 HTML 后进剪贴板，粘到公众号、飞书文档、Word 都保留排版
- 预览导出收进一个下拉菜单，除原有的长图外新增「导出 HTML」（单文件、样式内联、不依赖外部资源）和「保存 PDF」

### 修复

- 编辑器预览的 `dangerouslySetInnerHTML` 每次重渲染都新建一份 `{ __html }`，导致导出长图时整段正文被重设一遍、图片跟着重新请求

## [0.1.0] - 2026-07-29

### 新增

- 编辑器划词后浮出 AI 工具条，可对选中段落做润色 / 扩写 / 精简 / 自定义指令，结果需确认后才写回
- 划词四个动作的提示词进入「设置 → 提示词配置」，可编辑并恢复默认
- 编辑器工具栏加「复制全文」与「复制纯文本」两个按钮，三个视图共用，纯文本走 `lib/markdown/plain-text.ts` 按行剥标记，保留段落与缩进
- Docker 自部署说明与 `docker compose up -d --build` 一条命令的构建配置
- 常见 OpenAI 兼容服务的 CORS 直连实测表，以及本地模型 / 自建网关的放行方式
- README 补充 AI 配置、提示词配置、本地数据与深色模式配图

### 变更

- 选区 AI 的系统提示词从代码里的英文硬编码改为设置中的中文提示词，`buildMessages` 现在需要传入配置
- 设置里的「基础配置」改名为「AI 配置」（英文 Basic → AI），直说是模型连接那一块
- `PRD.md` 移到 `docs/PRD.md`
- PNG / ZIP 导出、二维码生成、图片裁剪改为用到时才加载，首屏 JS 从 745 KB 降到 620 KB（gzip）
- Front Matter 的切分与拼装改为 `lib/markdown/front-matter.ts` 自己实现（js-yaml），不再经过 gray-matter
- 小红书预览的重算依赖收窄到实际用到的样式字段，改配色不再触发「等图片加载 → 重新测量分页 → 重新克隆每页」
- 小红书与公众号工作区重复的设置卡片抽成 `components/common/setting-card.tsx`
- 引入 Prettier 统一代码格式（`printWidth: 100`，不含 Markdown），`pnpm check` 相应增加 `format:check`

### 修复

- 身份卡片的徽章、位置、缩放改动没有显式触发预览克隆卡片刷新，此前是靠「任意样式变动都重排一次」意外兜住的

### 移除

- 删掉从未被挂载的 `components/workbench/ai-panel.tsx`，其能力由划词浮层承接
- 移除 `gray-matter` 依赖（它为支持 JS Front Matter 引擎静态引入了 esprima，本项目只用 YAML）
