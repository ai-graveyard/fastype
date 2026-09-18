"use client";

import * as React from "react";
import { toast } from "sonner";

import type { EditorApi } from "@/components/editor/markdown-editor";
import { useT } from "@/components/providers/prefs-provider";
import { blobToDataUrl, formatBytes } from "@/lib/image/data-url";
import { encodeImageFile } from "@/lib/image/encode";
import { saveImage } from "@/lib/image/library";

/**
 * 把本地图片插进正文。
 *
 * 图片缩放、重编码之后收进 IndexedDB，正文里只留一条短引用；下载、复制、导出那一刻
 * 再换回 data URI，所以带走的 Markdown 依然是自包含的（lib/image/library.ts）。
 *
 * IndexedDB 用不了（无痕模式、用户禁用）时退回老办法，直接把 data URI 写进正文——
 * 费 localStorage 配额，但插图这件事不能因此不可用；配额真的耗尽时 lib/storage 会提示。
 */
/** 先进图片库，进不去就退回内嵌 data URI；两条路都不通才算这张图失败。 */
async function storeImage(blob: Blob, width: number, height: number): Promise<string | null> {
  const ref = await saveImage(blob, width, height);
  if (ref) return ref;
  try {
    return await blobToDataUrl(blob);
  } catch {
    return null;
  }
}

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
        const src = await storeImage(result.blob, result.width, result.height);
        if (!src) {
          failed += 1;
          continue;
        }
        bytes += result.blob.size;
        // alt 用文件名（去掉扩展名），比空 alt 更有意义，也方便之后搜索定位。
        const alt = file.name.replace(/\.[^.]+$/, "").replace(/[[\]]/g, "");
        snippets.push(`![${alt}](${src})`);
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
