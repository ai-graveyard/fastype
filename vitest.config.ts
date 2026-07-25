import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    // 解析、消毒、公众号内联样式和分页测量都依赖 DOM。
    environment: "jsdom",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    globals: true,
    restoreMocks: true,
    // 整棵工作台渲染出来要几秒，并发跑满时默认的 5s 会偶发超时。
    testTimeout: 15_000,
  },
});
