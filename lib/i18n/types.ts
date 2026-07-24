import type { Dict } from "./zh";

/** 把 zh 的字面量类型放宽成 string，供其它语言包实现。 */
export type Translation = {
  [K in keyof Dict]: { [P in keyof Dict[K]]: string };
};

export const LOCALES = ["zh", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** 从浏览器语言推断初始语言；不匹配时默认中文（PRD FT-SET-004）。 */
export function detectLocale(languages: readonly string[]): Locale {
  for (const lang of languages) {
    const lower = lang.toLowerCase();
    if (lower.startsWith("zh")) return "zh";
    if (lower.startsWith("en")) return "en";
  }
  return "zh";
}
