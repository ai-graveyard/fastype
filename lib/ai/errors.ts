import type { AiError } from "./types";

/** 规范化 Base URL：去掉尾部斜杠，校验协议。 */
export function normalizeBaseUrl(baseUrl: string): URL | null {
  const trimmed = baseUrl.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.pathname = url.pathname.replace(/\/+$/, "");
    return url;
  } catch {
    return null;
  }
}

/** 展示给用户的实际请求地址，绝不包含 API Key（PRD 10.2）。 */
export function chatCompletionsUrl(baseUrl: string): string | null {
  const url = normalizeBaseUrl(baseUrl);
  if (!url) return null;
  // 已经写到 /chat/completions 的就不再追加。
  if (url.pathname.endsWith("/chat/completions")) return url.toString();
  return `${url.origin}${url.pathname}/chat/completions`;
}

/**
 * HTTPS 页面调用 HTTP 接口会被浏览器直接拦下（PRD 第 11 节）。
 * localhost 是例外：浏览器把它当作安全来源。
 */
export function isMixedContent(target: string, pageProtocol: string, hostname: string): boolean {
  if (pageProtocol !== "https:") return false;
  try {
    const url = new URL(target);
    if (url.protocol !== "http:") return false;
    const local = ["localhost", "127.0.0.1", "[::1]", "::1"];
    if (local.includes(url.hostname)) return false;
    void hostname;
    return true;
  } catch {
    return false;
  }
}

export function isCrossOrigin(target: string, pageOrigin: string): boolean {
  try {
    return new URL(target).origin !== pageOrigin;
  } catch {
    return true;
  }
}

export interface ClassifyContext {
  target: string;
  pageOrigin: string;
  model: string;
  timeoutSeconds: number;
}

/** 把 HTTP 状态码翻译成可操作的提示（PRD FT-AI-002）。 */
export function classifyStatus(
  status: number,
  bodyText: string,
  context: ClassifyContext,
): AiError {
  const lower = bodyText.toLowerCase();
  const mentionsModel = lower.includes("model");

  if (status === 401 || status === 403) return { kind: "auth", messageKey: "ai.errAuth" };
  if (status === 429) return { kind: "rateLimit", messageKey: "ai.errRateLimit" };
  if (status === 404) {
    return mentionsModel
      ? { kind: "model", messageKey: "ai.errModel", params: { model: context.model } }
      : { kind: "notFound", messageKey: "ai.errNotFound" };
  }
  if (status === 400 && mentionsModel) {
    return { kind: "model", messageKey: "ai.errModel", params: { model: context.model } };
  }
  if (status >= 500) {
    return { kind: "server", messageKey: "ai.errServer", params: { status } };
  }
  return { kind: "incompatible", messageKey: "ai.errIncompatible" };
}

/** fetch 抛错时区分超时、混合内容、跨域和普通网络失败。 */
export function classifyThrown(error: unknown, context: ClassifyContext): AiError {
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return {
      kind: "timeout",
      messageKey: "ai.errTimeout",
      params: { seconds: context.timeoutSeconds },
    };
  }
  if (isCrossOrigin(context.target, context.pageOrigin)) {
    return {
      kind: "cors",
      messageKey: "ai.errCors",
      params: { origin: context.pageOrigin },
    };
  }
  return { kind: "network", messageKey: "ai.errNetwork" };
}
