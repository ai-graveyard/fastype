import type { TKey } from "@/lib/i18n";

/** 字体方案只用系统字体，不引入远程字体（PRD 10.2）。 */
export const FONT_STACKS = {
  sans: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif',
  serif: 'Georgia, "Songti SC", "SimSun", "Noto Serif CJK SC", "Source Han Serif SC", serif',
  hei: '"Heiti SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif',
  kai: '"Kaiti SC", STKaiti, KaiTi, BiauKai, "Noto Serif CJK SC", serif',
  fangsong: 'STFangsong, FangSong, "FangSong_GB2312", "Noto Serif CJK SC", serif',
  rounded:
    '"PingFang SC", "Hiragino Maru Gothic ProN", "Yuanti SC", "Microsoft YaHei", "Segoe UI", sans-serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
  xingkai: 'STXingkai, "Xingkai SC", "HanziPen SC", "Kaiti SC", STKaiti, KaiTi, cursive',
  lishu: 'STLiti, "LiSu", "Noto Serif CJK SC", SimSun, serif',
  youyuan: '"YouYuan", "Yuanti SC", "PingFang SC", "Microsoft YaHei", sans-serif',
  xinwei: 'STXinwei, "Xin Wei", "Noto Serif CJK SC", SimSun, serif',
  hupo: 'STHupo, "Heiti SC", "PingFang SC", "Microsoft YaHei", sans-serif',
} as const;

export type FontChoice = keyof typeof FONT_STACKS;
export const FONT_CHOICES = Object.keys(FONT_STACKS) as FontChoice[];

export function isFontChoice(value: unknown): value is FontChoice {
  return typeof value === "string" && value in FONT_STACKS;
}

export function fontStack(choice: FontChoice): string {
  return FONT_STACKS[choice] ?? FONT_STACKS.sans;
}

export interface ThemeMeta {
  id: string;
  /** i18n 键，避免在主题配置里硬编码中英文（PRD 12.3）。 */
  labelKey: TKey;
}

/** 标题自动编号；小红书和公众号共用同一套字段，渲染各自实现。 */
export const HEADING_NUMBER_POSITIONS = ["behind", "top", "bottom", "left"] as const;
export type HeadingNumberPosition = (typeof HEADING_NUMBER_POSITIONS)[number];
export const HEADING_NUMBER_LABEL_POSITIONS = ["right", "left", "top", "bottom"] as const;
export type HeadingNumberLabelPosition = (typeof HEADING_NUMBER_LABEL_POSITIONS)[number];

export interface HeadingNumberStyle {
  enabled: boolean;
  sizeMultiplier: number;
  position: HeadingNumberPosition;
  color: string;
  opacity: number;
  labelText: string;
  labelPosition: HeadingNumberLabelPosition;
  labelSizeMultiplier: number;
  labelColor: string;
  labelOpacity: number;
}

export const DEFAULT_HEADING_NUMBER: HeadingNumberStyle = {
  enabled: false,
  sizeMultiplier: 3,
  position: "behind",
  color: "",
  opacity: 0.12,
  labelText: "",
  labelPosition: "right",
  labelSizeMultiplier: 0.8,
  labelColor: "",
  labelOpacity: 0.12,
};
