import { describe, expect, it } from "vitest";

import { buildDocumentMessages, buildMessages, cleanAiOutput, parseSseLine } from "@/lib/ai/client";
import {
  chatCompletionsUrl,
  classifyStatus,
  classifyThrown,
  isCrossOrigin,
  isMixedContent,
  normalizeBaseUrl,
} from "@/lib/ai/errors";
import {
  DEFAULT_AI_CONFIG,
  DEFAULT_AI_PROMPTS,
  isAiConfigured,
  isRetryable,
  parseAiConfig,
} from "@/lib/ai/types";

const CONTEXT = {
  target: "https://api.example.com/v1/chat/completions",
  pageOrigin: "https://app.example.org",
  model: "gpt-4o-mini",
  timeoutSeconds: 60,
};

describe("normalizeBaseUrl / chatCompletionsUrl", () => {
  it("补上 /chat/completions", () => {
    expect(chatCompletionsUrl("https://api.openai.com/v1")).toBe(
      "https://api.openai.com/v1/chat/completions",
    );
  });

  it("忽略尾部斜杠", () => {
    expect(chatCompletionsUrl("https://api.openai.com/v1///")).toBe(
      "https://api.openai.com/v1/chat/completions",
    );
  });

  it("已经写全的地址不重复追加", () => {
    expect(chatCompletionsUrl("https://api.openai.com/v1/chat/completions")).toBe(
      "https://api.openai.com/v1/chat/completions",
    );
  });

  it("拒绝非 http(s) 协议", () => {
    expect(normalizeBaseUrl("ftp://x.com")).toBeNull();
    expect(normalizeBaseUrl("javascript:alert(1)")).toBeNull();
    expect(chatCompletionsUrl("不是地址")).toBeNull();
    expect(chatCompletionsUrl("")).toBeNull();
  });

  it("允许本地模型服务", () => {
    expect(chatCompletionsUrl("http://localhost:11434/v1")).toBe(
      "http://localhost:11434/v1/chat/completions",
    );
  });
});

describe("isMixedContent", () => {
  it("HTTPS 页面调用 HTTP 接口会被拦截", () => {
    expect(isMixedContent("http://api.example.com/v1", "https:", "app.example.org")).toBe(true);
  });

  it("localhost 是安全来源，不算混合内容", () => {
    expect(isMixedContent("http://localhost:1234/v1", "https:", "app.example.org")).toBe(false);
    expect(isMixedContent("http://127.0.0.1:1234/v1", "https:", "app.example.org")).toBe(false);
  });

  it("HTTP 页面不受限制", () => {
    expect(isMixedContent("http://api.example.com", "http:", "localhost")).toBe(false);
  });

  it("HTTPS 接口永远没问题", () => {
    expect(isMixedContent("https://api.example.com", "https:", "app.example.org")).toBe(false);
  });
});

describe("classifyStatus", () => {
  it("401/403 判为鉴权失败", () => {
    expect(classifyStatus(401, "", CONTEXT).kind).toBe("auth");
    expect(classifyStatus(403, "", CONTEXT).kind).toBe("auth");
  });

  it("404 提示检查 Base URL 是否需要 /v1", () => {
    const error = classifyStatus(404, "not found", CONTEXT);
    expect(error.kind).toBe("notFound");
    expect(error.messageKey).toBe("ai.errNotFound");
  });

  it("404 且提到 model 时判为模型不存在", () => {
    const error = classifyStatus(404, '{"error":{"message":"The model does not exist"}}', CONTEXT);
    expect(error.kind).toBe("model");
    expect(error.params?.model).toBe("gpt-4o-mini");
  });

  it("400 提到 model 时同样归类为模型问题", () => {
    expect(classifyStatus(400, "invalid model name", CONTEXT).kind).toBe("model");
  });

  it("429 判为限流，5xx 判为服务端错误", () => {
    expect(classifyStatus(429, "", CONTEXT).kind).toBe("rateLimit");
    const server = classifyStatus(503, "", CONTEXT);
    expect(server.kind).toBe("server");
    expect(server.params?.status).toBe(503);
  });

  it("其它状态码归类为协议不兼容", () => {
    expect(classifyStatus(418, "", CONTEXT).kind).toBe("incompatible");
  });
});

describe("classifyThrown", () => {
  it("超时被单独识别", () => {
    const error = classifyThrown(new DOMException("timeout", "TimeoutError"), CONTEXT);
    expect(error.kind).toBe("timeout");
    expect(error.params?.seconds).toBe(60);
  });

  it("跨域失败提示放行当前站点来源", () => {
    const error = classifyThrown(new TypeError("Failed to fetch"), CONTEXT);
    expect(error.kind).toBe("cors");
    expect(error.params?.origin).toBe("https://app.example.org");
  });

  it("同源失败归为普通网络错误", () => {
    const error = classifyThrown(new TypeError("Failed to fetch"), {
      ...CONTEXT,
      target: "https://app.example.org/v1/chat/completions",
    });
    expect(error.kind).toBe("network");
  });

  it("错误信息里永远不会出现 API Key", () => {
    const error = classifyStatus(401, "key sk-secret-value leaked in body", CONTEXT);
    expect(JSON.stringify(error)).not.toContain("sk-secret-value");
  });
});

describe("isRetryable", () => {
  it("配置类错误不自动重试", () => {
    expect(isRetryable({ kind: "auth", messageKey: "ai.errAuth" })).toBe(false);
    expect(isRetryable({ kind: "model", messageKey: "ai.errModel" })).toBe(false);
    expect(isRetryable({ kind: "cors", messageKey: "ai.errCors" })).toBe(false);
  });

  it("超时和网络错误可以重试", () => {
    expect(isRetryable({ kind: "timeout", messageKey: "ai.errTimeout" })).toBe(true);
    expect(isRetryable({ kind: "network", messageKey: "ai.errNetwork" })).toBe(true);
  });
});

describe("isCrossOrigin", () => {
  it("同源判断", () => {
    expect(isCrossOrigin("https://a.com/v1", "https://a.com")).toBe(false);
    expect(isCrossOrigin("https://b.com/v1", "https://a.com")).toBe(true);
    expect(isCrossOrigin("坏地址", "https://a.com")).toBe(true);
  });
});

describe("parseSseLine", () => {
  it("解析增量内容", () => {
    const line = 'data: {"choices":[{"delta":{"content":"你好"}}]}';
    expect(parseSseLine(line)).toEqual({ type: "delta", text: "你好" });
  });

  it("识别结束标记", () => {
    expect(parseSseLine("data: [DONE]")).toEqual({ type: "done" });
  });

  it("忽略心跳、注释和空行", () => {
    expect(parseSseLine("")).toBeNull();
    expect(parseSseLine(": ping")).toBeNull();
    expect(parseSseLine("event: message")).toBeNull();
  });

  it("忽略被截断的 JSON，等下一轮补齐", () => {
    expect(parseSseLine('data: {"choices":[{"delta"')).toBeNull();
  });

  it("空 delta 不产生事件", () => {
    expect(parseSseLine('data: {"choices":[{"delta":{}}]}')).toBeNull();
  });
});

describe("buildMessages", () => {
  const labels = {
    customInstruction: "instruction:",
    contextBefore: "before:",
    contextAfter: "after:",
    selection: "selection:",
    document: "document:",
  };

  it("只发送选中文本和有限上下文，不发整篇文章", () => {
    const messages = buildMessages(DEFAULT_AI_CONFIG, {
      action: "polish",
      labels,
      selection: "选中的句子",
      contextBefore: "前文",
      contextAfter: "后文",
    });
    const user = messages[1].content;
    expect(user).toContain("选中的句子");
    expect(user).toContain("前文");
    expect(user).toContain("后文");
    expect(messages[0].role).toBe("system");
  });

  it("自定义指令进入提示词", () => {
    const messages = buildMessages(DEFAULT_AI_CONFIG, {
      action: "custom",
      labels,
      selection: "文本",
      customInstruction: "改成口语",
    });
    expect(messages[1].content).toContain("改成口语");
  });

  it("没有上下文时不塞空段落", () => {
    const messages = buildMessages(DEFAULT_AI_CONFIG, {
      action: "condense",
      labels,
      selection: "文本",
    });
    expect(messages[1].content).not.toContain("选区前文");
    expect(messages[1].content).not.toContain("选区后文");
  });

  it("系统提示词取用户在设置里改过的那一份", () => {
    const messages = buildMessages(
      {
        ...DEFAULT_AI_CONFIG,
        prompts: { ...DEFAULT_AI_CONFIG.prompts, polish: "只把句子改短。" },
      },
      { action: "polish", labels, selection: "文本" },
    );
    expect(messages[0].content).toBe("只把句子改短。");
  });
});

describe("buildDocumentMessages", () => {
  it("发送完整文档，并把敏感词提示词的平台占位符替换掉", () => {
    const messages = buildDocumentMessages(
      {
        ...DEFAULT_AI_CONFIG,
        prompts: {
          ...DEFAULT_AI_PROMPTS,
          sensitive: "检查 {{platform}}，只返回 Markdown。",
        },
      },
      {
        action: "sensitive",
        content: "# 标题\n\n正文",
        platform: "小红书",
        documentLabel: "待处理的完整 Markdown：",
      },
    );

    expect(messages[0].content).toBe("检查 小红书，只返回 Markdown。");
    expect(messages[1].content).toContain("# 标题\n\n正文");
  });

  it("去 AI 味默认提示词包含 Stop Slop 的关键约束", () => {
    const messages = buildDocumentMessages(DEFAULT_AI_CONFIG, {
      action: "humanize",
      content: "原文",
      platform: "通用内容平台",
      documentLabel: "待处理的完整 Markdown：",
    });

    expect(messages[0].content).toContain("铺垫式开场");
    expect(messages[0].content).toContain("主动语态");
    expect(messages[0].content).toContain("不是 X，而是 Y");
  });
});

describe("cleanAiOutput", () => {
  it("剥掉整段包裹的围栏", () => {
    expect(cleanAiOutput("```markdown\n正文内容\n```")).toBe("正文内容");
    expect(cleanAiOutput("```\n正文内容\n```")).toBe("正文内容");
  });

  it("正文里本来就有代码块时保持原样", () => {
    const text = "说明：\n\n```js\ncode\n```\n\n结束";
    expect(cleanAiOutput(text)).toBe(text);
  });

  it("整段就是一段代码时不误删内部围栏", () => {
    const nested = "```\n外层\n```\n内部\n```\n";
    expect(cleanAiOutput(nested)).toContain("```");
  });

  it("空输出返回空串", () => {
    expect(cleanAiOutput("   \n ")).toBe("");
  });
});

describe("parseAiConfig", () => {
  it("坏字段回落到默认值而不是整份丢弃", () => {
    const config = parseAiConfig({
      baseUrl: "https://api.example.com/v1",
      apiKey: "sk-x",
      model: "m",
      temperature: "热",
      maxTokens: -5,
    });
    expect(config?.baseUrl).toBe("https://api.example.com/v1");
    expect(config?.temperature).toBe(DEFAULT_AI_CONFIG.temperature);
    expect(config?.maxTokens).toBe(64);
    expect(config?.prompts).toEqual(DEFAULT_AI_PROMPTS);
  });

  it("保留自定义提示词，缺失的提示词回落默认值", () => {
    const config = parseAiConfig({
      prompts: { humanize: "我的去味规则", sensitive: "" },
    });
    expect(config?.prompts.humanize).toBe("我的去味规则");
    expect(config?.prompts.sensitive).toBe(DEFAULT_AI_PROMPTS.sensitive);
  });

  it("老存档没有划词提示词时补上默认值，已改过的全文提示词不受影响", () => {
    // 加入划词功能之前存下的配置里只有这两条。
    const config = parseAiConfig({
      baseUrl: "https://api.example.com/v1",
      apiKey: "sk-x",
      model: "m",
      prompts: { humanize: "我的去味规则", sensitive: "我的敏感词规则" },
    });
    expect(config?.prompts.humanize).toBe("我的去味规则");
    expect(config?.prompts.sensitive).toBe("我的敏感词规则");
    expect(config?.prompts.polish).toBe(DEFAULT_AI_PROMPTS.polish);
    expect(config?.prompts.expand).toBe(DEFAULT_AI_PROMPTS.expand);
    expect(config?.prompts.condense).toBe(DEFAULT_AI_PROMPTS.condense);
    expect(config?.prompts.custom).toBe(DEFAULT_AI_PROMPTS.custom);
  });

  it("非对象返回 null", () => {
    expect(parseAiConfig("x")).toBeNull();
    expect(parseAiConfig(null)).toBeNull();
  });

  it("三项齐全才算配置完成", () => {
    expect(isAiConfigured(DEFAULT_AI_CONFIG)).toBe(false);
    expect(
      isAiConfigured({ ...DEFAULT_AI_CONFIG, baseUrl: "https://x", apiKey: "k", model: "m" }),
    ).toBe(true);
    expect(
      isAiConfigured({ ...DEFAULT_AI_CONFIG, baseUrl: "https://x", apiKey: "  ", model: "m" }),
    ).toBe(false);
  });
});
