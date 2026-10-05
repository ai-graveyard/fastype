import { expect, test, type Page } from "@playwright/test";
import { DEFAULT_XHS_STYLE } from "../../lib/themes/xhs";

const article =
  "# 我的真实文章\n\n这段正文必须保留。\n\n## 准备工作\n\n**找到问题**，再列出方法。\n\n1. 记录\n2. 整理\n\n## 开始行动\n\n> 每一步都值得记录。";
const readStyle = (page: Page, platform: string) =>
  page.evaluate(
    (key) => JSON.parse(localStorage.getItem(`fastype:style:${key}`) ?? "null")?.data,
    platform,
  );
const readDraft = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("fastype:draft") ?? "null")?.data?.content);

test.beforeEach(async ({ page }) => {
  await page.addInitScript((content) => {
    localStorage.setItem(
      "fastype:prefs",
      JSON.stringify({ v: 1, data: { locale: "zh", lastView: "xhs" } }),
    );
    if (!localStorage.getItem("fastype:draft")) {
      localStorage.setItem(
        "fastype:draft",
        JSON.stringify({ v: 1, data: { filename: "article.md", content, savedAt: 1 } }),
      );
    }
  }, article);
  await page.goto("/");
  await expect(page.locator(".cm-content").first()).toContainText("每一步都值得记录");
  await expect.poll(() => readDraft(page)).toBe(article);
});

test("每个模板独占一行，一次选择与撤回均保留正文", async ({ page }, testInfo) => {
  const before = await readStyle(page, "xhs");
  await page.getByRole("button", { name: "场景模板", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button")).toHaveCount(4);
  await expect(dialog.getByRole("button", { name: "应用到当前平台" })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "示例文章" })).toHaveCount(0);
  expect((await dialog.boundingBox())!.height).toBeLessThanOrEqual(
    page.viewportSize()!.height * 0.94 + 1,
  );
  await expect
    .poll(() => dialog.evaluate((el) => el.scrollHeight <= el.clientHeight + 1))
    .toBe(true);
  const positions: number[] = [];
  for (const id of ["knowledge", "checklist", "essay"]) {
    const preview = dialog.locator(`[data-scene-preview="${id}"]`);
    const bounds = (await preview.boundingBox())!;
    expect(bounds.width).toBeGreaterThan(600);
    expect(bounds.height).toBeGreaterThan(130);
    expect(bounds.height).toBeLessThan(230);
    positions.push(bounds.y);
    await expect(preview.getByTestId("xhs-grid-card")).toHaveCount(4);
    await expect
      .poll(() =>
        preview.getByTestId("xhs-grid-card").evaluateAll((cards) =>
          cards.every((card) => {
            const identifier = card.querySelector(".ft-xhs-identifier");
            if (!identifier || identifier.getAttribute("data-position") !== "top-left")
              return false;
            const page = card.getBoundingClientRect();
            const mark = identifier.getBoundingClientRect();
            return mark.top >= page.top && mark.bottom <= page.top + page.height * 0.2;
          }),
        ),
      )
      .toBe(true);
    const coverBounds = (await preview.getByTestId("xhs-grid-card").nth(0).boundingBox())!;
    const bodyBounds = (await preview.getByTestId("xhs-grid-card").nth(3).boundingBox())!;
    expect(coverBounds.width).toBeGreaterThanOrEqual(100);
    expect(bodyBounds.x).toBeGreaterThan(coverBounds.x);
    expect(bodyBounds.y).toBeCloseTo(coverBounds.y, 0);
    await expect(preview.getByTestId("xhs-grid-card").first()).toContainText("把一个想法讲清楚");
    await expect(preview.getByTestId("xhs-grid")).toContainText("先找到关键问题");
    expect(
      await preview
        .getByTestId("xhs-grid")
        .evaluate((el) => el.scrollHeight <= el.clientHeight + 1),
    ).toBe(true);
  }
  expect(positions[0]).toBeLessThan(positions[1]);
  expect(positions[1]).toBeLessThan(positions[2]);
  expect(await readStyle(page, "xhs")).toEqual(before);
  await page.screenshot({ path: testInfo.outputPath("scenes-xhs.png") });
  await page.setViewportSize({ width: 1280, height: 600 });
  await expect
    .poll(() => dialog.evaluate((el) => el.scrollHeight <= el.clientHeight + 1))
    .toBe(true);
  await expect
    .poll(
      async () =>
        (await dialog
          .locator('[data-scene-preview="knowledge"]')
          .getByTestId("xhs-grid-card")
          .first()
          .boundingBox())!.height,
    )
    .toBeLessThan(120);
  await dialog.getByRole("button", { name: "关闭", exact: true }).click();
  expect(await readStyle(page, "xhs")).toEqual(before);
  await page.getByRole("button", { name: "场景模板", exact: true }).click();
  await dialog.getByRole("button", { name: "步骤清单", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect
    .poll(() => readStyle(page, "xhs"))
    .toMatchObject({
      themeId: "forest",
      identifier: { position: "top-left", showOnCover: true },
      headings: { h2: { number: { enabled: true } } },
    });
  await expect(
    page.getByTestId("xhs-export-pages").locator(".ft-xhs-identifier").first(),
  ).toHaveAttribute("data-position", "top-left");
  expect(await readDraft(page)).toBe(article);
  await page.getByRole("button", { name: "撤回这次套用", exact: true }).click();
  await expect.poll(() => readStyle(page, "xhs")).toEqual(before ?? DEFAULT_XHS_STYLE);
});

test("公众号缩略展示封面和正文，一次应用不影响小红书", async ({ page }, testInfo) => {
  const xhsBefore = await readStyle(page, "xhs");
  await page.getByRole("tab", { name: "公众号", exact: true }).click();
  await page.getByRole("button", { name: "场景模板", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const preview = dialog.locator('[data-scene-preview="checklist"]');
  await expect(preview.locator("[data-wechat-cover-artwork=wide]")).toContainText(
    "把一个想法讲清楚",
  );
  await expect(preview.getByTestId("scene-wechat-body-thumbnail")).toHaveCount(3);
  await expect(preview.locator("h2 [aria-hidden=true]").first()).toHaveText("01");
  expect((await dialog.boundingBox())!.height).toBeLessThanOrEqual(
    page.viewportSize()!.height * 0.94 + 1,
  );
  await expect(dialog.getByTestId("xhs-export-pages")).toHaveCount(0);
  await expect(dialog.getByRole("button")).toHaveCount(4);
  await expect
    .poll(() => dialog.evaluate((el) => el.scrollHeight <= el.clientHeight + 1))
    .toBe(true);
  await page.screenshot({ path: testInfo.outputPath("scenes-wechat.png") });
  await dialog.getByRole("button", { name: "步骤清单", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect
    .poll(() => readStyle(page, "wechat"))
    .toMatchObject({
      themeId: "forest",
      fontSize: 15,
      headings: { h2: { number: { enabled: true } } },
    });
  expect(await readStyle(page, "xhs")).toEqual(xhsBefore);
  expect(await readDraft(page)).toBe(article);
});

test("窄屏每个模板保持独立一行，键盘套用且无横向溢出", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "场景模板", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.locator('[data-scene-preview="essay"]').getByTestId("xhs-grid"),
  ).toContainText("先找到关键问题");
  expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  await expect
    .poll(() => dialog.evaluate((el) => el.scrollHeight <= el.clientHeight + 1))
    .toBe(true);
  const gallery = dialog.getByTestId("scene-gallery");
  const story = dialog.locator('[data-scene-preview="essay"]');
  expect(await story.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  const lastCard = story.getByTestId("xhs-grid-card").last();
  expect((await lastCard.boundingBox())!.width).toBeGreaterThanOrEqual(100);
  await lastCard.scrollIntoViewIfNeeded();
  await expect.poll(() => story.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  expect(await gallery.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  const rows = await gallery.locator("[data-scene-preview]").all();
  const rowBounds = await Promise.all(rows.map((row) => row.boundingBox()));
  expect(rowBounds[0]!.y).toBeLessThan(rowBounds[1]!.y);
  expect(rowBounds[1]!.y).toBeLessThan(rowBounds[2]!.y);
  expect(rowBounds[0]!.x).toBeCloseTo(rowBounds[2]!.x, 0);
  expect((await dialog.boundingBox())!.height).toBeLessThanOrEqual(
    page.viewportSize()!.height * 0.94 + 1,
  );
  await dialog.getByRole("button", { name: "观点故事", exact: true }).focus();
  await expect(dialog.getByRole("button", { name: "观点故事", exact: true })).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath("scenes-mobile.png") });
  await dialog.getByRole("button", { name: "观点故事", exact: true }).press("Enter");
  await expect(dialog).toHaveCount(0);
  await expect
    .poll(() => readStyle(page, "xhs"))
    .toMatchObject({ fontFamily: "serif", themeId: "elegant" });
  expect(await readDraft(page)).toBe(article);
});

test("空正文也展示四张样张，套用模板不会填入示例正文", async ({ page }) => {
  await page.locator(".cm-content").first().fill("");
  await expect.poll(() => readDraft(page)).toBe("");
  await page.getByRole("button", { name: "场景模板", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.locator('[data-scene-preview="knowledge"]').getByTestId("xhs-grid"),
  ).toContainText("把一个想法讲清楚");
  await expect(
    dialog.locator('[data-scene-preview="knowledge"]').getByTestId("xhs-grid-card"),
  ).toHaveCount(4);
  await dialog.getByRole("button", { name: "知识科普", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(() => readStyle(page, "xhs")).toMatchObject({ themeId: "ocean" });
  expect(await readDraft(page)).toBe("");
});

test("自定义画布下模板仍按固定比例缩略显示", async ({ page }) => {
  await page.evaluate(
    (style) => {
      localStorage.setItem("fastype:style:xhs", JSON.stringify({ v: 1, data: style }));
    },
    { ...DEFAULT_XHS_STYLE, aspectRatio: "custom", customWidth: 720, customHeight: 2160 },
  );
  await page.reload();
  await page.getByRole("button", { name: "场景模板", exact: true }).click();
  const dialog = page.getByRole("dialog");
  for (const id of ["knowledge", "checklist", "essay"]) {
    const preview = dialog.locator(`[data-scene-preview="${id}"]`);
    const card = preview.getByTestId("xhs-grid-card").first();
    await expect(card).toContainText("把一个想法讲清楚");
    const bounds = (await card.boundingBox())!;
    expect(bounds.height).toBeGreaterThan(130);
    expect(bounds.height).toBeLessThanOrEqual(200);
    expect(bounds.height / bounds.width).toBeCloseTo(4 / 3, 1);
    await expect
      .poll(() =>
        preview.locator("[inert]").evaluate((el) => {
          const frame = el.getBoundingClientRect();
          return Array.from(el.querySelectorAll('[data-testid="xhs-grid-card"]')).every((card) => {
            const rect = card.getBoundingClientRect();
            return rect.top >= frame.top - 1 && rect.bottom <= frame.bottom + 1;
          });
        }),
      )
      .toBe(true);
  }
});
