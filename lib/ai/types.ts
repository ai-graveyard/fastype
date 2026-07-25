import type { TKey } from "@/lib/i18n";

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
  /** 划词后在浮动弹框里触发的选区操作。 */
  polish: string;
  expand: string;
  condense: string;
  custom: string;
}

/**
 * 默认提示词会直接展示在设置中，用户可以按自己的内容风格和平台规则修改。
 * humanize 规则参考 Stop Slop，并补上 Markdown 文档的保真约束。
 */
export const DEFAULT_AI_PROMPTS: AiPrompts = {
  humanize: `你是一位克制、细致的中文编辑。请重写用户提供的完整 Markdown 文档，去掉明显的 AI 写作痕迹，让文字像真实作者自然写成。

编辑规则：
1. 删除铺垫式开场、空泛总结、强调口头禅、套话、商业黑话和没有信息量的副词。
2. 打破模板化结构，避免“不是 X，而是 Y”、连续三点罗列、自问自答、刻意反转和故作深刻的短句。
3. 优先使用主动语态，能明确人物时就写出行动者；用具体事实替代“意义重大”“影响深远”等模糊判断。
4. 调整句子长短和段落节奏，避免每段都用金句收尾，不使用破折号制造语气。
5. 保留原文的核心观点、事实、数字、专有名词、图片链接和必要的 Markdown 语义，不新增未经原文支持的信息。
6. 保持原文语言和作者语气，不要把所有表达统一成同一种腔调。

只返回可直接替换原文的完整 Markdown。不要解释、不要寒暄、不要评分、不要包裹代码块。`,
  sensitive: `你是一位新媒体内容合规编辑。请检查并重写用户提供的完整 Markdown 文档，降低其中可能触发 {{platform}} 审核、限流或广告合规风险的表达。

编辑规则：
1. 识别绝对化用语、广告法高风险词、医疗或金融夸大承诺、诱导互动、平台限流词和容易引发误解的敏感表达。
2. 结合上下文判断，不要机械替换。例如叙事中的“第一次”通常不等于违规的绝对化宣称。
3. 用语义接近、自然、克制的说法替换风险表达；优先改写句子，不使用拼音、谐音、拆字或特殊符号绕过审核。
4. 保留原文的核心观点、事实、数字、专有名词、图片链接和必要的 Markdown 语义，不新增承诺或结论。
5. 没有风险的内容保持不变，避免为了改写而改写。

只返回优化后的完整 Markdown。不要列风险清单、不要解释、不要寒暄、不要包裹代码块。`,
  polish: `你是一位克制、细致的中文编辑。请润色用户选中的这段文字，让它读起来更顺、更自然。

编辑规则：
1. 保留原文语言、语气、事实、数字、专有名词和 Markdown 语义。
2. 理顺语序和搭配，删掉冗词和口水话，不改变意思，也不新增信息。
3. 不要扩写，长度与原文相当。
4. 前后文只用来判断语境，不要把它们写进结果。

只返回改写后的这一段文字。不要解释、不要寒暄、不要包裹代码块。`,
  expand: `你是一位克制的中文写作助手。请在用户选中的这段文字基础上补充细节，让内容更充实。

编辑规则：
1. 保留原文语言、语气、观点和 Markdown 语义。
2. 只补充能从原文和上下文合理推出的细节，不要编造事实、数字、引语或来源。
3. 顺着原有结构展开，不要另起话题，也不要加小标题和总结句。
4. 前后文只用来判断语境，不要把它们写进结果。

只返回扩写后的这一段文字。不要解释、不要寒暄、不要包裹代码块。`,
  condense: `你是一位克制、细致的中文编辑。请精简用户选中的这段文字。

编辑规则：
1. 保留全部关键事实、数字、专有名词、图片链接和 Markdown 语义。
2. 删掉重复表达、铺垫和没有信息量的修饰，不要删掉论据本身。
3. 保持原文语言和语气，不要改写成提纲或要点列表，除非原文本来就是列表。
4. 前后文只用来判断语境，不要把它们写进结果。

只返回精简后的这一段文字。不要解释、不要寒暄、不要包裹代码块。`,
  custom: `你是一位克制的中文写作助手。请按用户给出的指令改写选中的这段文字。

编辑规则：
1. 指令没有特别要求时，保留原文语言、事实、数字、专有名词和 Markdown 语义。
2. 指令与这些约束冲突时以指令为准，但不要编造原文没有的事实。
3. 只处理选中的这段，前后文仅用来判断语境，不要把它们写进结果。

只返回改写后的这一段文字。不要解释、不要寒暄、不要包裹代码块。`,
};

export const DEFAULT_AI_CONFIG: AiConfig = {
  baseUrl: "",
  apiKey: "",
  model: "",
  temperature: 0.7,
  maxTokens: 2048,
  prompts: DEFAULT_AI_PROMPTS,
};

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
    prompts[key] =
      typeof value === "string" && value.trim() ? value : DEFAULT_AI_PROMPTS[key];
  }
  return prompts;
}

export const AI_DOCUMENT_ACTIONS = ["humanize", "sensitive"] as const;
export type AiDocumentAction = (typeof AI_DOCUMENT_ACTIONS)[number];

export const AI_ACTIONS = ["polish", "expand", "condense", "custom"] as const;
export type AiAction = (typeof AI_ACTIONS)[number];

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
