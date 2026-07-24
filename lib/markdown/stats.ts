export interface DocStats {
  /** 中文按字计、西文按词计。 */
  words: number;
  /** 可见字符数（不含首尾空白）。 */
  chars: number;
}

export interface EditorInputLimits {
  /** 中文按字计、西文按词计。 */
  words: number;
  /** Markdown 源码中的 Unicode 字符数。 */
  chars: number;
}

export interface PreviewContentStats {
  /** 正文中实际出现的图片数量，重复地址也按展示次数计。 */
  images: number;
  /** 除一级标题之外的小标题数量。 */
  subheadings: number;
  /** 需要从远程地址加载的图片数量。 */
  remoteImages: number;
}

const CJK = /[㐀-䶿一-鿿豈-﫿぀-ヿ가-힯]/gu;
const LATIN_WORD = /[A-Za-z0-9][A-Za-z0-9'’\-_.]*/g;

/** 统计的是渲染后的可见文本，不是 Markdown 源码（PRD FT-EDT-002）。 */
export function countText(text: string): DocStats {
  const trimmed = text.trim();
  if (!trimmed) return { words: 0, chars: 0 };
  const cjk = trimmed.match(CJK)?.length ?? 0;
  const latin = trimmed.replace(CJK, " ").match(LATIN_WORD)?.length ?? 0;
  return {
    words: cjk + latin,
    chars: [...trimmed].length,
  };
}

/**
 * 统计编辑器硬上限。
 *
 * 字数沿用状态栏口径；字符数统计完整 Markdown 源码，确保格式标记、空白和换行
 * 也不会绕过平台声明的“可输入字符”上限。
 */
export function countEditorInput(text: string): DocStats {
  return {
    words: countText(text).words,
    chars: Array.from(text).length,
  };
}

/**
 * 正常文档只能停留在双上限以内；若打开的是历史超限文档，仍允许同时不增加
 * 字数和字符数的修改，保证用户可以继续删除、缩短内容。
 */
export function isEditorInputChangeAllowed(
  currentText: string,
  nextText: string,
  limits: EditorInputLimits,
): boolean {
  const next = countEditorInput(nextText);
  if (next.words <= limits.words && next.chars <= limits.chars) return true;

  const current = countEditorInput(currentText);
  return next.words <= current.words && next.chars <= current.chars;
}

/** 从已经消毒的预览 HTML 中提取发布相关结构统计。 */
export function countPreviewContent(html: string): PreviewContentStats {
  if (!html || typeof document === "undefined") {
    return { images: 0, subheadings: 0, remoteImages: 0 };
  }
  const holder = document.createElement("div");
  holder.innerHTML = html;
  const images = Array.from(holder.querySelectorAll("img"));
  return {
    images: images.length,
    subheadings: holder.querySelectorAll("h2, h3, h4, h5, h6").length,
    remoteImages: images.filter((image) =>
      /^https?:/i.test(image.getAttribute("src") ?? ""),
    ).length,
  };
}

/** 中英文混排取折中速度；只用于给作者一个内容量级提示。 */
export function estimateReadingMinutes(words: number): number {
  return words > 0 ? Math.max(1, Math.ceil(words / 400)) : 0;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
