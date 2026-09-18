import { expect, test } from "@playwright/test";

test("编辑、切换双平台并自动恢复草稿", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("tab", { name: /Editor|编辑器/ })).toBeVisible();
  const editor = page.locator(".cm-content").first();
  await expect(editor).toBeVisible();
  await editor.fill("# Browser smoke\n\nCross-browser draft.");

  await page.getByRole("tab", { name: /Xiaohongshu|小红书/ }).click();
  await expect(page.getByRole("tab", { name: /Content|内容/ })).toBeVisible();

  await page.getByRole("tab", { name: /WeChat|公众号/ }).click();
  await expect(page.getByRole("button", { name: /^Copy$|^复制$/ })).toBeVisible();

  await page.waitForTimeout(3_200);
  await page.reload();

  await expect(page.locator(".cm-content").first()).toContainText("Browser smoke");
});
