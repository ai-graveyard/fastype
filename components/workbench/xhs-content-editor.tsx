"use client";

import { Wand2, X } from "lucide-react";
import * as React from "react";

import { useT } from "@/components/providers/prefs-provider";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { suggestXhsMetadata, type XhsMetadata } from "@/lib/markdown/xhs-frontmatter";
import { XHS_INPUT_LIMITS, XHS_LIMITS } from "@/lib/themes/xhs";
import { cn } from "@/lib/utils";

const TAG_LIMIT = 10;

interface XhsContentEditorProps {
  /** 图片正文 Markdown，用于「自动填充」从一级标题和正文提取建议值。 */
  sourceBody: string;
  metadata: XhsMetadata;
  onMetadataChange: (patch: Partial<XhsMetadata>) => void;
}

function SettingCard({
  title,
  description,
  count,
  overLimit = false,
  children,
}: {
  title: string;
  description: string;
  count: string;
  overLimit?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "space-y-3 rounded-lg border border-border bg-card p-4 transition-colors",
        overLimit && "border-destructive/60",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full border border-border px-2.5 py-0.5 text-[11px] tabular-nums text-muted-foreground",
            overLimit && "border-destructive/40 bg-destructive/10 font-medium text-destructive",
          )}
        >
          {count}
        </span>
      </div>
      {children}
    </section>
  );
}

export function XhsContentEditor({
  sourceBody,
  metadata,
  onMetadataChange,
}: XhsContentEditorProps) {
  const t = useT();
  const [tagInput, setTagInput] = React.useState("");
  const titleLength = Array.from(metadata.title).length;
  const titleOverLimit = titleLength > XHS_LIMITS.contentTitle;

  const handleAutoFill = React.useCallback(() => {
    onMetadataChange(suggestXhsMetadata(sourceBody));
  }, [sourceBody, onMetadataChange]);

  const addTags = React.useCallback(
    (raw: string) => {
      const candidates = raw
        .split(/[,，#\s]+/)
        .map((tag) => tag.trim())
        .filter(Boolean);
      if (!candidates.length) return;

      const next = [...metadata.tags];
      for (const tag of candidates) {
        if (next.length >= TAG_LIMIT) break;
        if (!next.includes(tag)) next.push(tag);
      }
      onMetadataChange({ tags: next });
      setTagInput("");
    },
    [metadata.tags, onMetadataChange],
  );

  return (
    <div className="mx-auto max-w-2xl space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border bg-card/50 px-4 py-3">
            <p className="min-w-0 text-xs leading-5 text-muted-foreground">
              {t("xhs.autoFillFromBodyDesc")}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5"
              disabled={!sourceBody.trim()}
              onClick={handleAutoFill}
            >
              <Wand2 className="size-3.5" />
              {t("xhs.autoFillFromBody")}
            </Button>
          </div>

          <SettingCard
            title={t("xhs.textTitle")}
            description={t("xhs.textTitleDesc")}
            overLimit={titleOverLimit}
            count={t("xhs.fieldCount", {
              current: titleLength,
              limit: XHS_LIMITS.contentTitle,
            })}
          >
            <Input
              value={metadata.title}
              maxLength={XHS_INPUT_LIMITS.contentTitle}
              aria-invalid={titleOverLimit}
              aria-label={t("xhs.textTitle")}
              placeholder={t("xhs.textTitlePlaceholder")}
              className={cn(
                "bg-background font-medium",
                titleOverLimit && "border-destructive focus-visible:border-destructive",
              )}
              onChange={(event) => onMetadataChange({ title: event.target.value })}
            />
          </SettingCard>

          <SettingCard
            title={t("xhs.textContent")}
            description={t("xhs.textContentDesc")}
            count={t("xhs.fieldCount", {
              current: Array.from(metadata.content).length,
              limit: XHS_LIMITS.contentBody,
            })}
          >
            <Textarea
              value={metadata.content}
              maxLength={XHS_LIMITS.contentBody}
              aria-label={t("xhs.textContent")}
              placeholder={t("xhs.textContentPlaceholder")}
              className="min-h-72 resize-y bg-background text-sm leading-6"
              onChange={(event) => onMetadataChange({ content: event.target.value })}
            />
          </SettingCard>

          <SettingCard
            title={t("xhs.tags")}
            description={t("xhs.tagsDesc")}
            count={t("xhs.tagCount", { current: metadata.tags.length, limit: TAG_LIMIT })}
          >
            <div className="flex min-h-10 flex-wrap items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 focus-within:border-ring">
              {metadata.tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-xs font-medium text-brand-primary transition-colors hover:border-destructive/40 hover:text-destructive"
                  title={t("xhs.removeTag")}
                  onClick={() =>
                    onMetadataChange({ tags: metadata.tags.filter((item) => item !== tag) })
                  }
                >
                  #{tag}
                  <X className="size-3" />
                </button>
              ))}
              <input
                value={tagInput}
                disabled={metadata.tags.length >= TAG_LIMIT}
                aria-label={t("xhs.tags")}
                placeholder={metadata.tags.length ? "" : t("xhs.tagsPlaceholder")}
                className="min-w-32 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
                onChange={(event) => setTagInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  addTags(tagInput);
                }}
                onBlur={() => addTags(tagInput)}
              />
            </div>
          </SettingCard>
    </div>
  );
}
