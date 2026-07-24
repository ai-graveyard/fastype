import { en } from "./en";
import { detectLocale, isLocale, LOCALES, type Locale, type Translation } from "./types";
import { zh, type Dict } from "./zh";

export { detectLocale, isLocale, LOCALES };
export type { Locale, Translation };

export const dictionaries: Record<Locale, Translation> = { zh, en };

/** `"xhs.exportAll"` 这样的点路径，覆盖全部文案键。 */
export type TKey = {
  [S in keyof Dict & string]: `${S}.${keyof Dict[S] & string}`;
}[keyof Dict & string];

export type TParams = Record<string, string | number>;

export function translate(locale: Locale, key: TKey, params?: TParams): string {
  const [section, leaf] = key.split(".") as [keyof Translation, string];
  const dict = dictionaries[locale] ?? dictionaries.zh;
  const group = dict[section] as Record<string, string> | undefined;
  // 找不到时回退到中文，再回退到 key 本身，保证界面不出现空白。
  const fallback = (dictionaries.zh[section] as Record<string, string> | undefined)?.[leaf];
  const raw = group?.[leaf] ?? fallback ?? key;
  return params ? interpolate(raw, params) : raw;
}

/** 只做 `{name}` 占位替换，不解析表达式，避免把用户内容当模板执行。 */
export function interpolate(template: string, params: TParams): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match,
  );
}

export const LOCALE_LABELS: Record<Locale, string> = {
  zh: "中",
  en: "EN",
};

export const LOCALE_FULL_LABELS: Record<Locale, string> = {
  zh: "简体中文",
  en: "English",
};
