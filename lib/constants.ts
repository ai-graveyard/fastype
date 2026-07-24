import type { EditorInputLimits } from "@/lib/markdown/stats";
import { XHS_LIMITS } from "@/lib/themes/xhs";

export const APP_VERSION = "0.1.0";
export const REPO_URL = "https://github.com/ailln/fastype";

/** 各发布平台正文编辑器的双重硬上限。 */
export const PLATFORM_INPUT_LIMITS = {
  xhs: {
    words: XHS_LIMITS.imageBodyWords,
    chars: XHS_LIMITS.imageBodyChars,
  },
  wechat: {
    words: 10_000,
    chars: 40_000,
  },
} as const satisfies Record<"xhs" | "wechat", EditorInputLimits>;
