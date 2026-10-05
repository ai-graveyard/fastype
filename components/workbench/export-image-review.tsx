"use client";

import * as React from "react";
import { useT } from "@/components/providers/prefs-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface ExportImageIssue {
  src: string;
  pages: number[];
}
export function ExportImageReview({
  issues,
  onResolve,
  onReplace,
  onLocate,
}: {
  issues: ExportImageIssue[] | null;
  onResolve: (proceed: boolean) => void;
  onReplace: (src: string, file: File) => Promise<boolean>;
  onLocate: (src: string) => void;
}) {
  const t = useT();
  const [busy, setBusy] = React.useState(false);
  return (
    <Dialog open={issues !== null} onOpenChange={(open) => !open && !busy && onResolve(false)}>
      <DialogContent
        closeLabel={t("common.close")}
        className="max-h-[85dvh] w-[calc(100%_-_2rem)] max-w-xl overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>{t("creator.imageReview")}</DialogTitle>
          <DialogDescription>{t("creator.imageReviewDesc")}</DialogDescription>
        </DialogHeader>
        {issues?.map((issue) => (
          <div key={issue.src} className="space-y-2 rounded-lg border border-border p-3">
            <p className="text-sm font-medium">
              {issue.pages.length
                ? t("creator.imagePages", { pages: issue.pages.join(", ") })
                : t("creator.imageUnknown")}
            </p>
            <p className="break-all text-xs text-muted-foreground">
              {issue.src.startsWith("data:") || issue.src.startsWith("fastype-img:")
                ? t("creator.imageLocal")
                : issue.src}
            </p>
            <div className="flex flex-wrap gap-2">
              <label className="cursor-pointer rounded-md border border-input px-3 py-2 text-xs font-medium">
                {t("creator.replaceImage")}
                <input
                  type="file"
                  aria-label={t("creator.replaceImage")}
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="sr-only"
                  disabled={busy}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) return;
                    setBusy(true);
                    void onReplace(issue.src, file)
                      .then((replaced) => {
                        if (replaced) onResolve(false);
                      })
                      .finally(() => setBusy(false));
                  }}
                />
              </label>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => {
                  onResolve(false);
                  onLocate(issue.src);
                }}
              >
                {t("creator.locateImage")}
              </Button>
            </div>
          </div>
        ))}
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => onResolve(false)}>
            {t("common.cancel")}
          </Button>
          <Button variant="destructive" disabled={busy} onClick={() => onResolve(true)}>
            {t("creator.continueExport")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
