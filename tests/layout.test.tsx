import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PrefsProvider, usePrefs } from "@/components/providers/prefs-provider";
import { LangApplier } from "@/components/providers/theme-provider";

function LocaleControls() {
  const { setLocale } = usePrefs();
  return (
    <>
      <button type="button" onClick={() => setLocale("zh")}>
        中文
      </button>
      <button type="button" onClick={() => setLocale("en")}>
        English
      </button>
    </>
  );
}

describe("页面语言", () => {
  it("客户端 locale 变化时同步 html lang", async () => {
    render(
      <PrefsProvider>
        <LangApplier />
        <LocaleControls />
      </PrefsProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "中文" }));
    await waitFor(() => expect(document.documentElement.lang).toBe("zh-CN"));

    fireEvent.click(screen.getByRole("button", { name: "English" }));
    await waitFor(() => expect(document.documentElement.lang).toBe("en"));
  });
});
