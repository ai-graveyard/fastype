import { expect, test, type Page } from "@playwright/test";

import { DEFAULT_XHS_STYLE } from "../../lib/themes/xhs";

async function openDocument(page: Page, markdown: string) {
  await page.addInitScript(
    (style) => {
      localStorage.setItem("fastype:style:xhs", JSON.stringify({ v: 1, data: style }));
    },
    {
      ...DEFAULT_XHS_STYLE,
      identifier: { ...DEFAULT_XHS_STYLE.identifier, enabled: false },
      showPageNumber: false,
    },
  );
  await page.goto("/");
  const editor = page.locator(".cm-content").first();
  await expect(editor).toBeVisible();
  await editor.fill(markdown);
  await page.getByRole("tab", { name: /Xiaohongshu|小红书/ }).click();
  await expect(page.getByTestId("xhs-export-pages")).toBeAttached();
}

function bodies(page: Page) {
  return page.locator('[data-testid="xhs-export-pages"] > .ft-xhs-card > .ft-xhs-body');
}

async function expectNoClipping(page: Page) {
  await expect
    .poll(async () =>
      bodies(page).evaluateAll((elements) =>
        elements.every((body) => {
          const bounds = body.getBoundingClientRect();
          const content = Array.from(
            body.querySelectorAll("p, li, tr, img, pre, h1, h2, h3, .ft-split"),
          );
          return content.every((element) => {
            const rect = element.getBoundingClientRect();
            return rect.bottom <= bounds.bottom + 1 && rect.right <= bounds.right + 1;
          });
        }),
      ),
    )
    .toBe(true);
}

const lines = (prefix: string, count: number) =>
  Array.from({ length: count }, (_, index) => `${prefix}${index}`).join("  \n");

test("段落利用页尾空间，富文本跨页连续且不缩小普通正文", async ({ page }) => {
  await openDocument(page, `${lines("前段", 10)}\n\n${lines("后段", 12)}`);
  await expect(bodies(page)).toHaveCount(2);
  await expect(bodies(page).first()).toContainText("后段0");
  await expect(bodies(page).last()).toContainText("后段11");
  await expectNoClipping(page);
  await expect(bodies(page).locator('[style*="scale("]')).toHaveCount(0);
});

test("无标点的长段落保留加粗、链接和完整字符", async ({ page }) => {
  const text = "连续内容不应被遗漏".repeat(180);
  await openDocument(page, `**${text}** [末尾链接](https://example.com)`);
  await expect.poll(() => bodies(page).count()).toBeGreaterThan(1);
  await expect
    .poll(async () => (await bodies(page).allTextContents()).join("").replace(/\s/g, ""))
    .toBe(text + "末尾链接");
  await expect(bodies(page).last().locator("a")).toHaveAttribute("href", "https://example.com");
  await expect(bodies(page).first().locator("strong").first()).toBeAttached();
  await expectNoClipping(page);
  await expect(bodies(page).locator('[style*="scale("]')).toHaveCount(0);
});

test("有序列表跨页续号，表格保留表头与全部行", async ({ page }) => {
  const list = Array.from({ length: 30 }, (_, index) => `${index + 7}. 列表项目${index}`).join(
    "\n",
  );
  const table = `| 名称 |\n| --- |\n${Array.from({ length: 30 }, (_, index) => `| 表格项目${index} |`).join("\n")}`;
  await openDocument(page, `${list}\n\n${table}`);
  await expect.poll(() => bodies(page).count()).toBeGreaterThan(2);
  await expect(bodies(page).locator("li")).toHaveCount(30);
  await expect(bodies(page).locator("tbody tr")).toHaveCount(30);
  const lists = await bodies(page)
    .locator("ol")
    .evaluateAll((elements) =>
      elements.map((element) => ({
        start: Number(element.getAttribute("start")),
        count: element.children.length,
      })),
    );
  let next = 7;
  for (const list of lists) {
    expect(list.start).toBe(next);
    next += list.count;
  }
  const tables = bodies(page).locator("table");
  for (let index = 0; index < (await tables.count()); index += 1)
    await expect(tables.nth(index).locator("thead")).toContainText("名称");
  await expectNoClipping(page);
});

for (const count of [10, 16]) {
  test(`图片在页尾适配或换页，前文 ${count} 行`, async ({ page }) => {
    await page.goto("/");
    const src = await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 600;
      canvas.height = 800;
      const context = canvas.getContext("2d")!;
      context.fillStyle = "#6f9b88";
      context.fillRect(0, 0, 600, 800);
      return canvas.toDataURL();
    });
    await openDocument(page, `${lines("图片前文", count)}\n\n![测试图片](${src})`);
    await expect(bodies(page)).toHaveCount(count === 10 ? 1 : 2);
    const image = bodies(page).locator("img");
    await expect
      .poll(async () =>
        image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0),
      )
      .toBe(true);
    const rect = await image.evaluate((node) => ({
      width: node.getBoundingClientRect().width,
      height: node.getBoundingClientRect().height,
    }));
    expect(rect.width / rect.height).toBeCloseTo(0.75, 2);
    if (count === 10) {
      expect(rect.height).toBeLessThan(800);
      expect(rect.height).toBeGreaterThanOrEqual((800 * 2) / 3);
    } else {
      expect(rect.height).toBeGreaterThan(800);
      expect(rect.height).toBeLessThanOrEqual((800 * 4) / 3 + 1);
    }
    await expectNoClipping(page);
    await expect(bodies(page).locator('[style*="transform: scale"]')).toHaveCount(0);
  });
}

test("超长单个列表项按行续页，末尾不被裁切", async ({ page }) => {
  await openDocument(page, `- ${"超高单项内容".repeat(280)}尾部标记`);
  await expect.poll(() => bodies(page).count()).toBeGreaterThan(1);
  await expect(bodies(page).last()).toContainText("尾部标记");
  await expect(bodies(page).locator('[style*="scale("]')).toHaveCount(0);
  await expectNoClipping(page);
});

test("不可拆的超高表格行完整缩放，预览与导出共用结果", async ({ page }) => {
  const text = "单元格内的长内容".repeat(200) + "表格尾部标记";
  await openDocument(page, `| 内容 |\n| --- |\n| ${text} |`);
  await expect(bodies(page)).toHaveCount(1);
  await expect(bodies(page).locator("td")).toHaveText(text);
  await expect(bodies(page).locator('[style*="scale("]')).toHaveCount(1);
  await expectNoClipping(page);
  const preview = page.getByTestId("xhs-grid-card").first().locator(".ft-xhs-body").first();
  await expect.poll(async () => preview.innerHTML()).toBe(await bodies(page).first().innerHTML());
});

test("图片加载期间字体触发重排，仍使用最终图片尺寸分页", async ({ page }) => {
  await page.goto("/");
  const dataUrl = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 800;
    return canvas.toDataURL();
  });
  let release: () => void = () => {};
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/pagination-pending.png", async (route) => {
    await pending;
    await route.fulfill({
      contentType: "image/png",
      body: Buffer.from(dataUrl.split(",")[1], "base64"),
    });
  });
  const src = new URL("/pagination-pending.png", page.url()).href;
  await openDocument(page, `${lines("图片前文", 16)}\n\n![等待加载的图片](${src})`);
  await page.evaluate(() => document.fonts.dispatchEvent(new Event("loadingdone")));
  release();
  await expect(bodies(page)).toHaveCount(2);
  await expect
    .poll(async () =>
      bodies(page)
        .locator("img")
        .evaluate((image) => image.getBoundingClientRect().height),
    )
    .toBeGreaterThan(800);
  await expectNoClipping(page);
  await expect(bodies(page).locator('[style*="transform: scale"]')).toHaveCount(0);
});
