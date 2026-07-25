import { describe, expect, it } from "vitest";

import { isXhsImagePagesOverLimit, XHS_INPUT_LIMITS, XHS_LIMITS } from "@/lib/themes/xhs";
import { PLATFORM_INPUT_LIMITS } from "@/lib/constants";

describe("小红书各内容区域的字数边界", () => {
  it("图片正文限制为 5000 字和 20000 字符，内容正文限制为 1000 字", () => {
    expect(XHS_LIMITS.imageBodyWords).toBe(5_000);
    expect(XHS_LIMITS.imageBodyChars).toBe(20_000);
    expect(XHS_LIMITS.contentBody).toBe(1_000);
  });

  it("公众号正文限制为 10000 字和 40000 字符", () => {
    expect(PLATFORM_INPUT_LIMITS.wechat).toEqual({
      words: 10_000,
      chars: 40_000,
    });
  });

  it("图片超过 18 页仅提醒平台会自动转为视频", () => {
    expect(XHS_LIMITS.imagePages).toBe(18);
    expect(isXhsImagePagesOverLimit(18)).toBe(false);
    expect(isXhsImagePagesOverLimit(19)).toBe(true);
  });

  it("内容正文标题 20 字后警告，但允许输入到 25 字", () => {
    expect(XHS_LIMITS.contentTitle).toBe(20);
    expect(XHS_INPUT_LIMITS.contentTitle).toBe(25);
    expect(XHS_INPUT_LIMITS.contentTitle).toBeGreaterThan(XHS_LIMITS.contentTitle);
  });
});
