import {
  chatCompletionsUrl,
  classifyStatus,
  classifyThrown,
  isMixedContent,
  type ClassifyContext,
} from "./errors";
import type { AiAction, AiConfig, AiDocumentAction, AiError } from "./types";

/**
 * 浏览器直连 OpenAI 兼容 Chat Completions（PRD 9.4）。
 * 没有任何 FasType 中转，API Key 只出现在这一个 Authorization 头里。
 */

const TIMEOUT_MS = 60_000;

export interface ChatMessage {
  role: "system" | "user";
  content: string;
}

export interface StreamCallbacks {
  onDelta: (text: string) => void;
  /** 服务端不支持流式、已降级为一次性返回时触发一次。 */
  onFallbackToBlocking?: () => void;
}

export type AiResult =
  | { ok: true; content: string }
  /** 取消时把已生成的部分一并带回，交给用户处置（PRD 第 11 节）。 */
  | { ok: false; error: AiError; canceled?: boolean; content?: string };

function contextFor(config: AiConfig, target: string): ClassifyContext {
  return {
    target,
    pageOrigin: typeof window === "undefined" ? "" : window.location.origin,
    model: config.model,
    timeoutSeconds: Math.round(TIMEOUT_MS / 1000),
  };
}

interface RequestOptions {
  messages: ChatMessage[];
  signal?: AbortSignal;
  stream: boolean;
  maxTokens?: number;
  callbacks?: StreamCallbacks;
}

async function request(config: AiConfig, options: RequestOptions): Promise<AiResult> {
  const target = chatCompletionsUrl(config.baseUrl);
  if (!target) {
    return { ok: false, error: { kind: "invalidUrl", messageKey: "ai.errInvalidUrl" } };
  }

  if (
    typeof window !== "undefined" &&
    isMixedContent(target, window.location.protocol, window.location.hostname)
  ) {
    return { ok: false, error: { kind: "mixedContent", messageKey: "ai.errMixedContent" } };
  }

  const context = contextFor(config, target);
  // 超时和用户主动取消合成一个 signal；AbortSignal.any 在部分目标浏览器还不可用。
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(new DOMException("timeout", "TimeoutError")),
    TIMEOUT_MS,
  );
  options.signal?.addEventListener("abort", () => controller.abort(), { once: true });
  const signal = controller.signal;

  let response: Response;
  try {
    response = await fetch(target, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: options.messages,
        temperature: config.temperature,
        max_tokens: options.maxTokens ?? config.maxTokens,
        stream: options.stream,
      }),
      signal,
    });
    // 响应头到手就解除超时，长时间的流式生成不该被这个计时器打断。
    clearTimeout(timeoutId);
  } catch (error) {
    clearTimeout(timeoutId);
    if (options.signal?.aborted) {
      return { ok: false, canceled: true, error: { kind: "network", messageKey: "ai.canceled" } };
    }
    return { ok: false, error: classifyThrown(error, context) };
  }

  if (!response.ok) {
    // 只读取错误正文用于归类，不回显给用户，避免泄露服务端返回里的敏感内容。
    const body = await safeText(response);
    return { ok: false, error: classifyStatus(response.status, body, context) };
  }

  const contentType = response.headers.get("content-type") ?? "";
  const isEventStream = contentType.includes("text/event-stream");

  if (options.stream && !isEventStream) {
    options.callbacks?.onFallbackToBlocking?.();
    return readBlocking(response, context, options.callbacks);
  }
  if (!options.stream) {
    return readBlocking(response, context);
  }
  return readStream(response, context, options);
}

async function safeText(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 2000);
  } catch {
    return "";
  }
}

async function readBlocking(
  response: Response,
  context: ClassifyContext,
  callbacks?: StreamCallbacks,
): Promise<AiResult> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, error: { kind: "incompatible", messageKey: "ai.errIncompatible" } };
  }
  const content = extractContent(payload);
  if (content === null) {
    return { ok: false, error: { kind: "incompatible", messageKey: "ai.errIncompatible" } };
  }
  void context;
  if (content) callbacks?.onDelta(content);
  return { ok: true, content };
}

function extractContent(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const message = (choices[0] as { message?: { content?: unknown } }).message;
  if (!message || typeof message !== "object") return null;
  const content = message.content;
  return typeof content === "string" ? content : "";
}

async function readStream(
  response: Response,
  context: ClassifyContext,
  options: RequestOptions,
): Promise<AiResult> {
  const body = response.body;
  if (!body) {
    return { ok: false, error: { kind: "incompatible", messageKey: "ai.errIncompatible" } };
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const event = parseSseLine(line);
        if (!event) continue;
        if (event.type === "done") return { ok: true, content };
        content += event.text;
        options.callbacks?.onDelta(event.text);
      }
    }
  } catch (error) {
    if (options.signal?.aborted) {
      return {
        ok: false,
        canceled: true,
        content,
        error: { kind: "network", messageKey: "ai.canceled" },
      };
    }
    return { ok: false, error: classifyThrown(error, context) };
  } finally {
    reader.releaseLock();
  }

  return { ok: true, content };
}

export type SseEvent = { type: "delta"; text: string } | { type: "done" };

/** 解析一行 SSE；返回 null 表示这行不携带内容。 */
export function parseSseLine(line: string): SseEvent | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith(":")) return null;
  if (!trimmed.startsWith("data:")) return null;
  const data = trimmed.slice(5).trim();
  if (data === "[DONE]") return { type: "done" };
  try {
    const payload = JSON.parse(data) as {
      choices?: Array<{ delta?: { content?: unknown } }>;
    };
    const delta = payload.choices?.[0]?.delta?.content;
    return typeof delta === "string" && delta.length > 0 ? { type: "delta", text: delta } : null;
  } catch {
    // 中途被截断的 JSON 行直接跳过，下一轮 buffer 会补齐。
    return null;
  }
}

/**
 * 起标题：一次拿回若干候选，不走流式。
 *
 * 候选列表要整段解析完才能拆成几条摆给用户，边生成边显示只会让列表一直跳；
 * 输出本身也就几十个字，等一下比闪一屏更好。
 */
export async function runTitleAction(
  config: AiConfig,
  messages: ChatMessage[],
  signal?: AbortSignal,
): Promise<AiResult> {
  return request(config, { messages, stream: false, signal });
}

/** 连接测试：发一个极短的请求，验证鉴权、模型名和响应格式（PRD FT-AI-002）。 */
export async function testConnection(config: AiConfig, signal?: AbortSignal): Promise<AiResult> {
  return request(config, {
    messages: [{ role: "user", content: "ping" }],
    stream: false,
    maxTokens: 16,
    signal,
  });
}

export interface RunActionInput {
  action: AiAction;
  labels: AiMessageLabels;
  /** 选中的文本，这是唯一必然被发送的正文内容。 */
  selection: string;
  /** 选区前后的少量上下文，避免整篇文章被送出去（PRD FT-AI-003）。 */
  contextBefore?: string;
  contextAfter?: string;
  customInstruction?: string;
}

export interface AiMessageLabels {
  customInstruction: string;
  contextBefore: string;
  contextAfter: string;
  selection: string;
  document: string;
}

/** 系统提示词来自设置，用户可以逐条改写、也可以恢复默认。 */
export function buildMessages(config: AiConfig, input: RunActionInput): ChatMessage[] {
  const parts: string[] = [];
  if (input.action === "custom" && input.customInstruction?.trim()) {
    parts.push(`${input.labels.customInstruction}\n${input.customInstruction.trim()}`);
  }
  if (input.contextBefore?.trim()) {
    parts.push(`${input.labels.contextBefore}\n${input.contextBefore.trim()}`);
  }
  if (input.contextAfter?.trim()) {
    parts.push(`${input.labels.contextAfter}\n${input.contextAfter.trim()}`);
  }
  parts.push(`${input.labels.selection}\n${input.selection}`);
  return [
    { role: "system", content: config.prompts[input.action] },
    { role: "user", content: parts.join("\n\n") },
  ];
}

export async function runAction(
  config: AiConfig,
  input: RunActionInput,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
): Promise<AiResult> {
  return request(config, {
    messages: buildMessages(config, input),
    stream: true,
    signal,
    callbacks,
  });
}

export interface RunDocumentActionInput {
  action: AiDocumentAction;
  content: string;
  /** 去敏感词时用于替换提示词中的 {{platform}}。 */
  platform: string;
  documentLabel: string;
}

export function buildDocumentMessages(
  config: AiConfig,
  input: RunDocumentActionInput,
): ChatMessage[] {
  const prompt = config.prompts[input.action].replaceAll("{{platform}}", input.platform);
  return [
    { role: "system", content: prompt },
    { role: "user", content: `${input.documentLabel}\n\n${input.content}` },
  ];
}

/** 全文快捷操作：与选区 AI 分开，结果由界面预览确认后再写回编辑器。 */
export async function runDocumentAction(
  config: AiConfig,
  input: RunDocumentActionInput,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
): Promise<AiResult> {
  return request(config, {
    messages: buildDocumentMessages(config, input),
    stream: true,
    signal,
    callbacks,
  });
}

/**
 * 保守清洗模型输出（PRD FT-AI-004）。
 * 只在整段被同一个围栏包住时才剥掉，正文内部的代码块保持原样。
 */
export function cleanAiOutput(raw: string): string {
  const text = raw.trim();
  if (!text) return "";
  const match = text.match(/^```[\w-]*\n([\s\S]*?)\n?```$/);
  if (match) {
    const inner = match[1];
    // 内部还有围栏说明这本来就是一段代码，别动。
    if (!inner.includes("```")) return inner.trim();
  }
  return text;
}
