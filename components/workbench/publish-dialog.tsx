"use client";

import { Copy, Download } from "lucide-react";
import * as React from "react";
import { useT } from "@/components/providers/prefs-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader } from "@/components/ui/dialog";
import { DialogTitle } from "@/components/ui/dialog";
import { XhsContentEditor } from "@/components/workbench/xhs-content-editor";
import { WechatCoverEditor } from "@/components/workbench/wechat-cover-editor";
import { formatXhsPublishBody, type XhsMetadata } from "@/lib/markdown/xhs-frontmatter";
import { XHS_LIMITS } from "@/lib/themes/xhs";
import type { WechatCompatibilityIssue } from "@/lib/render/wechat";

export function PublishDialog({
  open,
  onOpenChange,
  platform,
  metadata,
  onMetadataChange,
  source,
  total,
  overflowPages,
  failedImages,
  exporting,
  onExport,
  onCopyWechat,
  onDownloadHtml,
  articleDocument,
  title,
  docBase,
  issues,
  onLocateIssue,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  platform: "xhs" | "wechat";
  metadata: XhsMetadata;
  onMetadataChange: (patch: Partial<XhsMetadata>) => void;
  source: string;
  total: number;
  overflowPages: number[];
  failedImages: number;
  exporting: boolean;
  onExport: () => void;
  onCopyWechat: () => void;
  onDownloadHtml: () => void;
  articleDocument: string;
  title: string;
  docBase: string;
  issues: WechatCompatibilityIssue[];
  onLocateIssue: (issue: WechatCompatibilityIssue) => void;
}) {
  const t = useT();
  const tooLong =
    Array.from(metadata.title).length > XHS_LIMITS.contentTitle ||
    Array.from(formatXhsPublishBody(metadata)).length > XHS_LIMITS.contentBody;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        closeLabel={t("common.close")}
        className="max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-3xl overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>{t("creator.publish")}</DialogTitle>
          <DialogDescription>{t("creator.publishDesc")}</DialogDescription>
        </DialogHeader>
        <div
          className="space-y-2 rounded-lg border border-border bg-muted/30 p-4 text-sm"
          role="status"
        >
          {platform === "xhs" ? (
            <>
              <p className="font-medium">{t("creator.checkPages", { n: total })}</p>
              {total > XHS_LIMITS.imagePages ? (
                <p className="text-warning">
                  {t("xhs.previewPageLimitOver", { max: XHS_LIMITS.imagePages })}
                </p>
              ) : null}
              {overflowPages.length ? (
                <p className="text-warning">
                  {t("creator.overflow", { pages: overflowPages.join(", ") })}
                </p>
              ) : null}
              {!metadata.title.trim() || !metadata.content.trim() ? (
                <p className="text-muted-foreground">{t("creator.publishTextMissing")}</p>
              ) : null}
              {tooLong ? <p className="text-destructive">{t("creator.publishTooLong")}</p> : null}
              <p className="text-xs text-muted-foreground">{t("creator.exportCheck")}</p>
            </>
          ) : (
            <>
              <p className="font-medium">{t("creator.wechatCompat")}</p>
              <p className="text-xs text-muted-foreground">{t("wechat.disclaimer")}</p>
              {issues.map((issue, index) => (
                <button
                  type="button"
                  className="block text-left text-xs text-warning underline underline-offset-4"
                  key={index}
                  onClick={() => {
                    onOpenChange(false);
                    onLocateIssue(issue);
                  }}
                >
                  {t(issue.warning)} {issue.preview.slice(0, 60)} · {t("wechat.compatLocate")}
                </button>
              ))}
              <p className="text-xs text-muted-foreground">{t("creator.wechatImageHint")}</p>
            </>
          )}
          {failedImages ? (
            <p className="text-destructive">{t("creator.imagesFailed", { n: failedImages })}</p>
          ) : null}
        </div>
        {platform === "xhs" ? (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <Button disabled={exporting || total === 0} onClick={onExport}>
                <Download />
                {exporting ? t("creator.checking") : t("creator.publishPackage")}
              </Button>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                {t("creator.previewBack")}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{t("creator.packageHint")}</p>
            <XhsContentEditor
              sourceBody={source}
              metadata={metadata}
              onMetadataChange={onMetadataChange}
            />
          </>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <Button onClick={onCopyWechat}>
                <Copy />
                {t("creator.wechatCopy")}
              </Button>
              <Button variant="outline" onClick={onDownloadHtml}>
                {t("wechat.downloadHtml")}
              </Button>
            </div>
            <details className="border-t border-border pt-4" data-testid="wechat-publish-assets">
              <summary className="cursor-pointer text-sm font-medium">
                {t("creator.wechatAssets")}
              </summary>
              <div className="mt-4">
                <WechatCoverEditor
                  publishOnly
                  documentTitle={title}
                  docBaseName={docBase}
                  articleDocument={articleDocument}
                />
              </div>
            </details>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
