"use client";

import * as React from "react";
import { toast } from "sonner";

import type { EditorApi } from "@/components/editor/markdown-editor";
import { useT } from "@/components/providers/prefs-provider";
import { formatBytes } from "@/lib/image/data-url";
import { encodeImageFile } from "@/lib/image/encode";

/**
 * 把本地图片插进正文。
 *
 * 图片会被缩放、重新编码成 data URI 直接写进 Markdown——文件拷到哪里图都还在，不依赖
 * FasType 也不依赖图床。代价是正文体积会涨，所以插入后把大小报给用户，超过配额时
 * 自动保存那边（lib/storage）会给出提示。
 */
export function useImageInsert(editorRef: React.RefObject<EditorApi | null>) {
  const t = useT();
  const [busy, setBusy] = React.useState(false);

  const insertFiles = React.useCallback(
    async (files: File[]) => {
      const api = editorRef.current;
      if (!api || files.length === 0) return;

      setBusy(true);
      const snippets: string[] = [];
      let failed = 0;
      let bytes = 0;

      for (const file of files) {
        const result = await encodeImageFile(file);
        if (!result.ok) {
          failed += 1;
          continue;
        }
        bytes += result.bytes;
        // alt 用文件名（去掉扩展名），比空 alt 更有意义，也方便之后搜索定位。
        const alt = file.name.replace(/\.[^.]+$/, "").replace(/[[\]]/g, "");
        snippets.push(`![${alt}](${result.dataUrl})`);
      }

      setBusy(false);

      if (snippets.length > 0) {
        // 顶到平台字数上限时编辑器会拒收，这时候不能报「已插入」。
        if (api.insertBlock(snippets.join("\n\n"))) {
          api.focus();
          toast.success(t("image.inserted", { n: snippets.length, size: formatBytes(bytes) }));
        } else {
          toast.error(t("image.insertRejected"), { duration: 8000 });
        }
      }
      if (failed > 0) toast.error(t("image.insertFailed", { n: failed }));
    },
    [editorRef, t],
  );

  return { insertFiles, busy };
}
