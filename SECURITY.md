# 安全策略

## 报告漏洞

请**不要**通过公开 issue 报告安全问题。

请发送邮件到仓库维护者，或使用 GitHub 的 [Private vulnerability reporting](https://docs.github.com/code-security/security-advisories/guidance-on-reporting-and-writing/privately-reporting-a-security-vulnerability) 功能。请附上复现步骤和影响范围，我们会尽快回复。

## 威胁模型

FasType 是纯前端应用，没有服务端，因此不存在服务端数据泄露面。真正需要关注的是浏览器内的这几类问题：

| 面 | 关注点 |
| --- | --- |
| 导入的 Markdown | 渲染前经 DOMPurify 消毒，过滤脚本、事件属性和危险协议 |
| API Key | 只存 localStorage，只随用户主动发起的请求发往用户填写的 Base URL |
| 导出产物 | 复制到公众号的 HTML 和下载的文件不得携带应用脚本 |
| 外部链接 | 使用 `rel="noopener noreferrer"` 打开 |
| 第三方代码 | 不引入运行时第三方脚本、远程字体和遥测 |

特别欢迎这几类报告：

- 能绕过 Markdown 消毒的 XSS
- 任何导致 API Key 出现在 URL、日志、导出文件或错误文案中的路径
- 导致本地草稿被静默清空或覆盖的场景

## 关于 API Key 存储

API Key 保存在浏览器 localStorage 中，**这不等同于系统钥匙串加密**。同一浏览器配置下运行的其它扩展或脚本可能读到它。这是 BYOK 纯前端方案的固有权衡，界面中也向用户明确说明了这一点。在共用设备上使用后，请通过「设置 → 本地数据 → 清除 AI 配置」删除。
