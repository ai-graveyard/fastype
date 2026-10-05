import { expect, test, type Locator } from "@playwright/test";

import { en } from "../../lib/i18n/en";
import { zh } from "../../lib/i18n/zh";

async function expectActionsFit(container: Locator, selector = "button:visible") {
  const bounds = await container.boundingBox();
  expect(bounds).not.toBeNull();
  const buttons = container.locator(selector);
  let previousRight = bounds!.x;
  for (const button of await buttons.all()) {
    const box = (await button.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(previousRight - 1);
    expect(box.x + box.width).toBeLessThanOrEqual(bounds!.x + bounds!.width + 1);
    previousRight = box.x + box.width;
  }
}

for (const locale of ["zh", "en"] as const) {
  const t = locale === "zh" ? zh : en;

  test(`${locale}: 窄屏按钮只显示图标，保留提示、名称和点击行为`, async ({ page }, testInfo) => {
    await page.addInitScript((locale) => {
      localStorage.setItem(
        "fastype:prefs",
        JSON.stringify({ v: 1, data: { locale, lastView: "xhs" } }),
      );
    }, locale);
    await page.goto("/");
    const toolbar = page.getByTestId("creator-toolbar");
    const paste = toolbar.getByRole("button", { name: t.creator.paste, exact: true });

    for (const width of [1280, 800, 640, 390, 320, 800]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(paste.locator("span")).toBeVisible({ visible: width > 640 });
      await expectActionsFit(toolbar);
      for (const button of await toolbar.getByRole("button").all()) {
        await expect(button.locator("svg")).toBeVisible();
        expect(await button.getAttribute("title")).toBe(await button.getAttribute("aria-label"));
      }
    }

    await page.setViewportSize({ width: 320, height: 900 });
    const mode = page.getByRole("button", { name: t.view.text, exact: true });
    await expect(mode.locator("span")).toBeHidden();
    const modeBounds = (await mode.boundingBox())!;
    expect(modeBounds.x + modeBounds.width).toBeLessThanOrEqual(320);
    await mode.click();
    await expect(mode).toHaveAttribute("aria-pressed", "true");
    await page.screenshot({ path: testInfo.outputPath("icon-only-320.png") });
    await paste.click();
    await expect(page.getByRole("dialog", { name: t.creator.paste, exact: true })).toBeVisible();
    await page.getByRole("button", { name: t.common.close, exact: true }).click();
    await toolbar.getByRole("button", { name: t.creator.publish, exact: true }).click();
    await expect(page.getByRole("dialog", { name: t.creator.publish, exact: true })).toBeVisible();
  });

  test(`${locale}: 按钮随分栏宽度收起和恢复，三个平台均不重叠`, async ({ page }) => {
    await page.addInitScript((locale) => {
      localStorage.setItem(
        "fastype:prefs",
        JSON.stringify({ v: 1, data: { locale, lastView: "xhs" } }),
      );
    }, locale);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto("/");

    for (const view of ["xhs", "wechat", "markdown"] as const) {
      await page.getByRole("tab", { name: t.view[view], exact: true }).click();
      const preview = page.getByRole("region", { name: t.a11y.previewRegion, exact: true });
      const action = preview.locator(".ft-toolbar-action").first();
      const splitter = page.getByRole("separator", { name: t.a11y.splitter, exact: true });
      for (const width of [900, 280, 900]) {
        const box = (await splitter.boundingBox())!;
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(width, box.y + box.height / 2);
        await page.mouse.up();
        await expect.poll(async () => Math.round((await preview.boundingBox())!.width)).toBe(width);
        await expect(action.locator("span").first()).toBeVisible({ visible: width > 640 });
        await expectActionsFit(
          preview.locator(".ft-toolbar-container > div").first(),
          view === "markdown" ? ".ft-toolbar-action" : "button:visible",
        );
      }
      if (view !== "markdown") {
        const header = page.getByTestId(`${view}-workspace-header`);
        await expectActionsFit(header);
        await header.getByRole("button", { name: t.creator.editDetails, exact: true }).click();
        await expect(page.getByRole("menu")).toBeVisible();
        await page.keyboard.press("Escape");
      }
    }
  });
}
