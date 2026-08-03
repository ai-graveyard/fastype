import { translate, type Locale, type TKey } from "@/lib/i18n";

export interface AiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  prompts: AiPrompts;
}

export interface AiPrompts {
  /** 全文快捷操作。 */
  humanize: string;
  sensitive: string;
  /** 起标题：一次生成若干候选，不改动正文。 */
  titles: string;
  /** 划词后在浮动弹框里触发的选区操作。 */
  polish: string;
  expand: string;
  condense: string;
  conversational: string;
  custom: string;
}

/**
 * 默认提示词会直接展示在设置中，用户可以按自己的内容风格和平台规则修改。
 * humanize 规则参考 Stop Slop，并补上 Markdown 文档的保真约束。
 */
export function getDefaultAiPrompts(locale: Locale = "zh"): AiPrompts {
  return {
    humanize: translate(locale, "ai.defaultHumanizePrompt"),
    sensitive: translate(locale, "ai.defaultSensitivePrompt"),
    titles: translate(locale, "ai.defaultTitlesPrompt"),
    polish: translate(locale, "ai.defaultPolishPrompt"),
    expand: translate(locale, "ai.defaultExpandPrompt"),
    condense: translate(locale, "ai.defaultCondensePrompt"),
    conversational: translate(locale, "ai.defaultConversationalPrompt"),
    custom: translate(locale, "ai.defaultCustomPrompt"),
  };
}

export const DEFAULT_AI_PROMPTS: AiPrompts = getDefaultAiPrompts();

export function getDefaultAiConfig(locale: Locale = "zh"): AiConfig {
  return {
    baseUrl: "",
    apiKey: "",
    model: "",
    temperature: 0.7,
    maxTokens: 2048,
    prompts: getDefaultAiPrompts(locale),
  };
}

export const DEFAULT_AI_CONFIG: AiConfig = getDefaultAiConfig();

export function isAiConfigured(config: AiConfig): boolean {
  return Boolean(config.baseUrl.trim() && config.apiKey.trim() && config.model.trim());
}

/** 从 localStorage 读回时的宽松校验；坏字段回落默认值，不整份丢弃。 */
export function parseAiConfig(raw: unknown): AiConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const input = raw as Partial<AiConfig>;
  const num = (value: unknown, fallback: number, min: number, max: number) =>
    typeof value === "number" && Number.isFinite(value)
      ? Math.min(max, Math.max(min, value))
      : fallback;
  return {
    baseUrl: typeof input.baseUrl === "string" ? input.baseUrl : "",
    apiKey: typeof input.apiKey === "string" ? input.apiKey : "",
    model: typeof input.model === "string" ? input.model : "",
    temperature: num(input.temperature, DEFAULT_AI_CONFIG.temperature, 0, 2),
    maxTokens: num(input.maxTokens, DEFAULT_AI_CONFIG.maxTokens, 64, 32000),
    prompts: parseAiPrompts(input.prompts),
  };
}

/** 逐条回落：老版本存档里没有的选区提示词会补上默认值，已改过的照旧保留。 */
function parseAiPrompts(raw: unknown): AiPrompts {
  const input = (raw ?? {}) as Partial<Record<keyof AiPrompts, unknown>>;
  const keys = Object.keys(DEFAULT_AI_PROMPTS) as Array<keyof AiPrompts>;
  const prompts = {} as AiPrompts;
  for (const key of keys) {
    const value = input[key];
    prompts[key] = typeof value === "string" && value.trim() ? value : DEFAULT_AI_PROMPTS[key];
  }
  return prompts;
}

export const AI_DOCUMENT_ACTIONS = ["humanize", "sensitive"] as const;
export type AiDocumentAction = (typeof AI_DOCUMENT_ACTIONS)[number];

export const AI_ACTIONS = ["polish", "expand", "condense", "conversational", "custom"] as const;
export type AiAction = (typeof AI_ACTIONS)[number];

/**
 * 划词浮层里不需要模型的动作。
 *
 * 去 Markdown 语法是一次确定的语法剥离，本地跑就够：不花 token、不用把正文发出去，
 * 同一段文字每次都得到同一个结果。实现直接复用「复制纯文本」那份。
 */
export const LOCAL_ACTIONS = ["removeMarkdown"] as const;
export type LocalAction = (typeof LOCAL_ACTIONS)[number];

export type SelectionAction = AiAction | LocalAction;

/** 浮层工具条上的展示顺序：改写类在前，格式类和自定义在后。 */
export const SELECTION_ACTIONS: readonly SelectionAction[] = [
  "polish",
  "expand",
  "condense",
  "conversational",
  "removeMarkdown",
  "custom",
];

export function isLocalAction(action: SelectionAction): action is LocalAction {
  return (LOCAL_ACTIONS as readonly string[]).includes(action);
}

export interface AiError {
  /** i18n 键，界面直接翻译，永远不包含 API Key。 */
  messageKey: TKey;
  params?: Record<string, string | number>;
  /** 归类，供上层决定是否允许自动重试。 */
  kind:
    | "auth"
    | "model"
    | "notFound"
    | "incompatible"
    | "cors"
    | "network"
    | "mixedContent"
    | "invalidUrl"
    | "timeout"
    | "rateLimit"
    | "server";
}

/** 鉴权和配置类错误不应该自动重试（PRD 第 11 节）。 */
export function isRetryable(error: AiError): boolean {
  return error.kind === "timeout" || error.kind === "network" || error.kind === "server";
}
