import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PrefsProvider } from "@/components/providers/prefs-provider";
import { WechatPreviewStatus } from "@/components/workbench/wechat-preview-status";

describe("公众号预览状态", () => {
  it("展示文章结构和可复制状态", () => {
    render(
      <PrefsProvider>
        <WechatPreviewStatus
          images={6}
          subheadings={8}
          readingMinutes={4}
          remoteImages={0}
          hasContent
        />
      </PrefsProvider>,
    );

    expect(
      screen.getByText(
        /6 images · 8 subheadings · 4 min read|6 张图片 · 8 个小标题 · 预计阅读 4 分钟/,
      ),
    ).toBeTruthy();
    expect(screen.getByText(/Ready to copy|可复制/)).toBeTruthy();
  });

  it("点击兼容性提醒后展示具体位置、原文和修改建议", async () => {
    const onLocateIssue = vi.fn();
    const linkIssue = {
      warning: "wechat.compatLink" as const,
      index: 1,
      preview: "OpenAI 官网 · https://openai.com",
      searchText: "OpenAI 官网",
    };
    render(
      <PrefsProvider>
        <WechatPreviewStatus
          images={0}
          subheadings={2}
          readingMinutes={1}
          remoteImages={0}
          warnings={["wechat.compatLink", "wechat.compatCode"]}
          issues={[
            linkIssue,
            {
              warning: "wechat.compatCode",
              index: 1,
              preview: "pnpm build",
              searchText: "pnpm build",
            },
          ]}
          hasContent
          onLocateIssue={onLocateIssue}
        />
      </PrefsProvider>,
    );

    const status = screen.getByRole("button", {
      name: /2 compatibility notes|2 项兼容性提醒/,
    });
    expect(status.getAttribute("data-severity")).toBe("warning");
    fireEvent.click(status);

    expect(screen.getByText(/Content to check|需要检查的内容/)).toBeTruthy();
    expect(screen.getByText(/External link 1|第 1 个外部链接/)).toBeTruthy();
    expect(screen.getByText("OpenAI 官网 · https://openai.com")).toBeTruthy();
    expect(
      screen.getByText(
        /External links in WeChat articles are usually not clickable|公众号正文中的外部链接通常不可点击/,
      ),
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", {
        name: /Locate in editor.*External link 1|在编辑器中定位：第 1 个外部链接/,
      }),
    );
    await waitFor(() => expect(onLocateIssue).toHaveBeenCalledWith(linkIssue));
  });

  it("图片加载失败使用错误状态", () => {
    render(
      <PrefsProvider>
        <WechatPreviewStatus
          images={2}
          subheadings={1}
          readingMinutes={1}
          remoteImages={2}
          failedImages={1}
          hasContent
        />
      </PrefsProvider>,
    );

    const status = screen.getByText(/1 images failed to load|1 张图片加载失败/);
    expect(status.getAttribute("data-severity")).toBe("error");
    expect(status.classList.contains("text-destructive")).toBe(true);
  });
});
