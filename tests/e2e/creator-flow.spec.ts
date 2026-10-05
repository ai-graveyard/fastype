import { expect, test } from "@playwright/test";
import JSZip from "jszip";
import { readFile } from "node:fs/promises";

const article =
  "# 一次简单的分享\n\n这是开头的一段内容。\n\n## 我的三个发现\n\n先记录，再整理，最后分享。\n\n## 写在最后\n\n把文章交到读者手里。";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("fastype:prefs"))
      localStorage.setItem(
        "fastype:prefs",
        JSON.stringify({ v: 1, data: { locale: "zh", lastView: "xhs" } }),
      );
  });
  await page.goto("/");
});

test("首次进入可编辑预览，粘贴文章、选择源码并刷新保留偏好", async ({ page }) => {
  await expect(page.getByRole("button", { name: "预览", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "粘贴我的内容", exact: true }).click();
  await page.getByRole("textbox", { name: "粘贴我的内容", exact: true }).fill(article);
  await page.getByRole("button", { name: "使用这篇内容", exact: true }).click();
  await expect(page.locator(".cm-content").first()).toContainText("一次简单的分享");
  await page.getByRole("button", { name: "文本", exact: true }).click();
  await expect(page.locator(".cm-lineNumbers")).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem("fastype:draft") ?? "null")?.data?.content,
      ),
    )
    .toBe(article);
  await page.reload();
  await expect(page.getByRole("button", { name: "文本", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator(".cm-content").first()).toContainText("一次简单的分享");
});

test("富文本粘贴保留结构且一次撤销可以恢复", async ({ page }) => {
  const editor = page.locator(".cm-content").first();
  await editor.fill("");
  await editor.evaluate((element) => {
    const html =
      '<h2>旅行清单</h2><p>带上<strong>相机</strong>和<a href="https://example.com">地图</a></p><ul><li>早点出发</li></ul>';
    // Firefox strips the payload from constructed ClipboardEvents. Supply the same inert fixture in every engine.
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", {
      value: {
        getData: (type: string) =>
          type === "text/html" ? html : "旅行清单 带上相机和地图 早点出发",
        items: [],
        types: ["text/html", "text/plain"],
      },
    });
    element.dispatchEvent(event);
  });
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem("fastype:draft") ?? "null")?.data?.content,
      ),
    )
    .toContain("**相机**");
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await expect(editor).not.toContainText("旅行清单");
});

test("手动分页刷新后仍生效，模板不会修改正文", async ({ page }, testInfo) => {
  await page.locator(".cm-content").first().fill(article);
  await page.getByRole("button", { name: "分页调整", exact: true }).click();
  await page.getByRole("checkbox", { name: "从这里另起一页 · 我的三个发现", exact: true }).check();
  await page.getByRole("button", { name: "返回检查排版", exact: true }).click();
  const cards = page.locator('[data-testid="xhs-export-pages"] > .ft-xhs-card');
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(1)).toContainText("我的三个发现");
  await expect(cards.nth(0)).not.toContainText("我的三个发现");
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem("fastype:draft") ?? "null")?.data?.content,
      ),
    )
    .toBe(article);
  await page.reload();
  await expect(cards).toHaveCount(2);
  await page.getByRole("button", { name: "场景模板", exact: true }).click();
  await page.getByRole("button", { name: "知识科普", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem("fastype:draft") ?? "null")?.data?.content,
      ),
    )
    .toBe(article);
  await expect(cards).toHaveCount(3);
  await expect(page.locator('[role="dialog"]')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("workbench.png"), fullPage: true });
});

test("刷新后恢复旧版本，并保留被恢复前的内容", async ({ page }) => {
  const editor = page.locator(".cm-content").first();
  await editor.fill(article);
  await page.getByRole("button", { name: "历史版本", exact: true }).click();
  await page.getByRole("button", { name: "保存当前版本", exact: true }).click();
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await editor.fill("# 修改后的新版本\n\n这一段也要保留。");
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem("fastype:draft") ?? "null")?.data?.content,
      ),
    )
    .toContain("修改后的新版本");
  await page.reload();
  await page.getByRole("button", { name: "历史版本", exact: true }).click();
  await page
    .getByRole("button", { name: /^查看版本/ })
    .first()
    .click();
  await expect(page.getByLabel("版本内容")).toContainText("一次简单的分享");
  await page.getByRole("button", { name: "恢复此版本", exact: true }).click();
  await expect(editor).toContainText("一次简单的分享");
  await page.getByRole("button", { name: "历史版本", exact: true }).click();
  await page
    .getByRole("button", { name: /^查看版本/ })
    .first()
    .click();
  await expect(page.getByLabel("版本内容")).toContainText("修改后的新版本");
});

test("小红书发布包包含真实 PNG 与标题正文文件", async ({ page }, testInfo) => {
  await page.locator(".cm-content").first().fill(article);
  await expect(page.getByTestId("xhs-export-pages")).toContainText("一次简单的分享");
  await page.getByRole("button", { name: "准备发布", exact: true }).click();
  await page.getByRole("textbox", { name: "标题", exact: true }).fill("分享标题");
  await page.getByRole("textbox", { name: "正文", exact: true }).fill("发布正文");
  await page.screenshot({ path: testInfo.outputPath("publish.png"), fullPage: true });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载图片与文案发布包", exact: true }).click();
  const file = await download;
  const archive = await JSZip.loadAsync(await readFile((await file.path())!));
  const names = Object.keys(archive.files);
  expect(names.some((name) => name.endsWith("-title.txt"))).toBe(true);
  expect(
    await archive.file(names.find((name) => name.endsWith("-body.txt"))!)!.async("string"),
  ).toBe("发布正文");
  const png = await archive.file(names.find((name) => name.endsWith(".png"))!)!.async("uint8array");
  expect(Array.from(png.slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(new DataView(png.buffer, png.byteOffset).getUint32(16)).toBe(1080);
});

test("缺图导出先暂停，可取消并用本地图片替换", async ({ page }) => {
  await page.route("**/unavailable-image.png", (route) => route.abort());
  await page
    .locator(".cm-content")
    .first()
    .fill("# 缺图测试\n\n![测试图片](https://example.com/unavailable-image.png)");
  await expect(page.getByTestId("xhs-export-pages")).toContainText("缺图测试");
  let downloads = 0;
  page.on("download", () => {
    downloads++;
  });
  await page.getByRole("button", { name: "准备发布", exact: true }).click();
  await page.getByRole("button", { name: "下载图片与文案发布包", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "导出图片需要处理", exact: true })).toBeVisible();
  expect(downloads).toBe(0);
  await page
    .getByRole("dialog", { name: "导出图片需要处理", exact: true })
    .getByRole("button", { name: "取消", exact: true })
    .click();
  expect(downloads).toBe(0);
  await page.getByRole("button", { name: "下载图片与文案发布包", exact: true }).click();
  await expect(page.getByLabel("替换成本地图片", { exact: true })).toHaveCount(1);
  await page.getByLabel("替换成本地图片", { exact: true }).setInputFiles("public/fastype-logo.png");
  await expect(
    page.getByRole("dialog", { name: "导出图片需要处理", exact: true }),
  ).not.toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem("fastype:draft") ?? "null")?.data?.content,
      ),
    )
    .not.toContain("https://example.com/unavailable-image.png");
});

test("窄屏可以粘贴文章并进入发布流程", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "粘贴我的内容", exact: true }).click();
  await page.getByRole("textbox", { name: "粘贴我的内容", exact: true }).fill(article);
  await page.getByRole("button", { name: "使用这篇内容", exact: true }).click();
  await page.getByRole("button", { name: "准备发布", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "准备发布", exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "下载图片与文案发布包", exact: true }),
  ).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test("公众号模板与发布包复用预览配置", async ({ page }, testInfo) => {
  await page.locator(".cm-content").first().fill(article);
  await page.getByRole("tab", { name: "公众号", exact: true }).click();
  await page.getByRole("button", { name: "场景模板", exact: true }).click();
  await page.getByRole("button", { name: "知识科普", exact: true }).click();
  await page.getByRole("button", { name: "准备发布", exact: true }).click();
  await expect(page.getByRole("button", { name: "复制公众号正文", exact: true })).toBeVisible();
  await page.getByText("公众号封面与发布包", { exact: true }).click();
  await expect(page.getByRole("button", { name: "下载发布包", exact: true })).toBeVisible();
  const assets = page.getByTestId("wechat-publish-assets");
  await expect(assets.getByRole("heading", { name: "公众号封面", exact: true })).toHaveCount(0);
  const covers = assets.locator("article");
  await expect(covers).toHaveCount(2);
  const wideBounds = (await covers.nth(0).boundingBox())!;
  const squareBounds = (await covers.nth(1).boundingBox())!;
  expect(squareBounds.x).toBeGreaterThan(wideBounds.x);
  expect(squareBounds.y).toBeCloseTo(wideBounds.y, 0);
  await page.screenshot({ path: testInfo.outputPath("wechat-publish.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  const dialog = page.getByRole("dialog", { name: "准备发布", exact: true });
  await expect.poll(() => dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  const mobileWide = (await covers.nth(0).boundingBox())!;
  const mobileSquare = (await covers.nth(1).boundingBox())!;
  expect(mobileSquare.x).toBeCloseTo(mobileWide.x, 0);
  expect(mobileSquare.y).toBeGreaterThan(mobileWide.y);
  await page.screenshot({ path: testInfo.outputPath("wechat-publish-mobile.png"), fullPage: true });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载发布包", exact: true }).click();
  const archive = await JSZip.loadAsync(await readFile((await (await download).path())!));
  const names = Object.keys(archive.files);
  const html = await archive.file(names.find((name) => name.endsWith(".html"))!)!.async("string");
  expect(html).toContain("一次简单的分享");
  expect(html).toContain("我的三个发现");
  const dimensions = await Promise.all(
    names
      .filter((name) => name.endsWith(".png"))
      .map(async (name) => {
        const png = await archive.file(name)!.async("uint8array");
        const view = new DataView(png.buffer, png.byteOffset);
        return [view.getUint32(16), view.getUint32(20)];
      }),
  );
  expect(dimensions).toEqual(
    expect.arrayContaining([
      [900, 383],
      [500, 500],
    ]),
  );
});
