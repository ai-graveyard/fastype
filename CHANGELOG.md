# 更新日志

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

推 `v*` 标签会触发 `.github/workflows/desktop-release.yml` 构建桌面安装包，发版前请把 Unreleased 里的条目归到对应版本下。

## [Unreleased]

### 新增

- 编辑器划词后浮出 AI 工具条，可对选中段落做润色 / 扩写 / 精简 / 自定义指令，结果需确认后才写回
- 划词四个动作的提示词进入「设置 → 提示词配置」，可编辑并恢复默认
- Docker 自部署说明与 `docker compose up -d --build` 一条命令的构建配置
- 常见 OpenAI 兼容服务的 CORS 直连实测表，以及本地模型 / 自建网关的放行方式
- README 补充 AI 配置、提示词配置、本地数据与深色模式配图

### 变更

- 选区 AI 的系统提示词从代码里的英文硬编码改为设置中的中文提示词，`buildMessages` 现在需要传入配置
- `PRD.md` 移到 `docs/PRD.md`

### 移除

- 删掉从未被挂载的 `components/workbench/ai-panel.tsx`，其能力由划词浮层承接
