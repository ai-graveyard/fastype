"use client";

import { ClipboardPaste, History, LayoutTemplate, Scissors, Send } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { useDocument } from "@/components/providers/document-provider";
import { usePrefs } from "@/components/providers/prefs-provider";
import { ScenePicker } from "@/components/workbench/scene-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { htmlToMarkdown } from "@/lib/markdown/from-html";
import type { LayoutBlock } from "@/lib/markdown/layout-anchors";
import { readHistory, type DraftSnapshot } from "@/lib/storage/history";
import type { DocumentLayout } from "@/lib/storage/document-layout";
import type { ViewId } from "@/lib/types";

export function CreatorToolbar({
  view,
  onPublish,
  onEdit,
  blocks,
  layout,
  onLayoutChange,
}: {
  view: ViewId;
  onPublish: () => void;
  onEdit: () => void;
  blocks: LayoutBlock[];
  layout: DocumentLayout;
  onLayoutChange: (layout: DocumentLayout) => void;
}) {
  const { t, locale } = usePrefs();
  const { content, setContent, checkpoint, restoreSnapshot } = useDocument();
  type Panel = "paste" | "templates" | "history" | "pagination";
  const [panel, setActivePanel] = React.useState<Panel>("paste");
  const [panelOpen, setPanelOpen] = React.useState(false);
  const setPanel = (next: Panel | null) => {
    if (next) setActivePanel(next);
    setPanelOpen(next !== null);
  };
  const [pasted, setPasted] = React.useState("");
  const [snapshots, setSnapshots] = React.useState<DraftSnapshot[]>([]);
  const [selected, setSelected] = React.useState<DraftSnapshot | null>(null);
  const pasteRef = React.useRef<HTMLTextAreaElement>(null);
  const titleKey =
    panel === "paste"
      ? "creator.paste"
      : panel === "templates"
        ? "creator.templates"
        : panel === "history"
          ? "creator.history"
          : "creator.pagination";
  const descriptionKey =
    panel === "paste"
      ? "creator.pasteDesc"
      : panel === "templates"
        ? "creator.templatesDesc"
        : panel === "history"
          ? "creator.historyDesc"
          : "creator.paginationDesc";
  const stale = layout.breakBefore.filter(
    (key) => !blocks.some((block) => block.key === key),
  ).length;

  return (
    <>
      <div
        className="ft-toolbar-container flex shrink-0 items-center gap-2 border-b border-border bg-background px-3 py-2"
        data-testid="creator-toolbar"
      >
        <Button
          aria-label={t("creator.paste")}
          title={t("creator.paste")}
          size="sm"
          className="ft-toolbar-action"
          variant="outline"
          onClick={() => {
            setPasted("");
            setPanel("paste");
          }}
        >
          <ClipboardPaste />
          <span className="ft-toolbar-label">{t("creator.paste")}</span>
        </Button>
        {view !== "markdown" ? (
          <Button
            aria-label={t("creator.templates")}
            title={t("creator.templates")}
            size="sm"
            className="ft-toolbar-action"
            variant="ghost"
            onClick={() => setPanel("templates")}
          >
            <LayoutTemplate />
            <span className="ft-toolbar-label">{t("creator.templates")}</span>
          </Button>
        ) : null}
        {view === "xhs" ? (
          <Button
            aria-label={t("creator.pagination")}
            title={t("creator.pagination")}
            size="sm"
            className="ft-toolbar-action"
            variant="ghost"
            onClick={() => setPanel("pagination")}
          >
            <Scissors />
            <span className="ft-toolbar-label">{t("creator.pagination")}</span>
          </Button>
        ) : null}
        <Button
          aria-label={t("creator.history")}
          title={t("creator.history")}
          size="sm"
          className="ft-toolbar-action"
          variant="ghost"
          onClick={() => {
            setSnapshots(readHistory());
            setSelected(null);
            setPanel("history");
          }}
        >
          <History />
          <span className="ft-toolbar-label">{t("creator.history")}</span>
        </Button>
        <span className="ft-creator-hint ml-auto text-xs text-muted-foreground">
          {t("creator.flow")}
        </span>
        {view !== "markdown" ? (
          <Button
            aria-label={t("creator.publish")}
            title={t("creator.publish")}
            size="sm"
            className="ft-toolbar-action ml-auto"
            onClick={onPublish}
            disabled={!content.trim()}
          >
            <Send />
            <span className="ft-toolbar-label">{t("creator.publish")}</span>
          </Button>
        ) : null}
      </div>
      <Dialog open={panelOpen} onOpenChange={(open) => !open && setPanel(null)}>
        <DialogContent
          className={`w-[calc(100%_-_2rem)] max-w-3xl overflow-y-auto ${panel === "templates" ? "max-h-[94dvh]" : "max-h-[90dvh]"}`}
          style={
            panel === "templates"
              ? ({
                  "--scene-card-height": "clamp(96px, calc((94dvh - 232px) / 3), 200px)",
                  maxWidth: "calc(var(--scene-card-height) * 3 + 236px)",
                } as React.CSSProperties)
              : undefined
          }
          closeLabel={t("common.close")}
          onOpenAutoFocus={(event) => {
            if (panel === "paste") {
              event.preventDefault();
              pasteRef.current?.focus();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>{t(titleKey)}</DialogTitle>
            <DialogDescription>{t(descriptionKey)}</DialogDescription>
          </DialogHeader>
          {panel === "paste" ? (
            <>
              <textarea
                ref={pasteRef}
                aria-label={t("creator.paste")}
                placeholder={t("creator.pastePlaceholder")}
                value={pasted}
                onChange={(event) => setPasted(event.target.value)}
                className="min-h-64 w-full resize-y rounded-lg border border-input bg-background p-4 text-sm leading-7"
                onPaste={(event) => {
                  const html = event.clipboardData.getData("text/html");
                  if (!html) return;
                  try {
                    const markdown = htmlToMarkdown(html);
                    if (!markdown) return;
                    event.preventDefault();
                    const { selectionStart, selectionEnd } = event.currentTarget;
                    setPasted(
                      pasted.slice(0, selectionStart) + markdown + pasted.slice(selectionEnd),
                    );
                    toast.success(t("creator.pasteConverted"));
                  } catch {
                    toast.error(t("creator.pasteFailed"));
                  }
                }}
              />
              <DialogFooter>
                <Button
                  disabled={!pasted.trim()}
                  onClick={() => {
                    checkpoint();
                    setContent(pasted);
                    setPanel(null);
                    onEdit();
                  }}
                >
                  {t("creator.pasteApply")}
                </Button>
              </DialogFooter>
            </>
          ) : null}
          {panel === "templates" && panelOpen ? (
            <ScenePicker
              view={view}
              keepHeadings={layout.keepHeadings}
              onClose={() => setPanel(null)}
            />
          ) : null}
          {panel === "history" ? (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  const ok = checkpoint();
                  setSnapshots(readHistory());
                  toast[ok ? "success" : "error"](
                    t(ok ? "creator.snapshotSaved" : "creator.snapshotFailed"),
                  );
                }}
              >
                {t("creator.snapshot")}
              </Button>
              {snapshots.length ? (
                <div className="grid min-h-0 gap-4 sm:grid-cols-[200px_1fr]">
                  <div className="max-h-80 space-y-2 overflow-y-auto">
                    {snapshots.map((snapshot) => {
                      const time = new Date(snapshot.savedAt).toLocaleString(locale);
                      return (
                        <button
                          key={snapshot.id}
                          aria-pressed={selected?.id === snapshot.id}
                          aria-label={t("creator.historySelect", { time })}
                          className="w-full rounded-lg border border-border p-3 text-left text-xs aria-pressed:border-brand-primary aria-pressed:bg-accent"
                          onClick={() => setSelected(snapshot)}
                        >
                          <span className="block font-medium">{time}</span>
                          <span className="mt-1 block truncate text-muted-foreground">
                            {snapshot.filename}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="min-w-0 space-y-3">
                    {selected ? (
                      <>
                        <pre
                          aria-label={t("creator.historyPreview")}
                          className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-3 text-xs leading-6"
                        >
                          {selected.content}
                        </pre>
                        <Button
                          onClick={() => {
                            restoreSnapshot(selected);
                            setPanel(null);
                            onEdit();
                            toast.success(t("creator.restored"));
                          }}
                        >
                          {t("creator.restore")}
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              ) : (
                <p className="py-8 text-sm text-muted-foreground">{t("creator.historyEmpty")}</p>
              )}
            </>
          ) : null}
          {panel === "pagination" ? (
            <>
              <label className="flex items-start gap-3 rounded-lg border border-border p-3">
                <input
                  type="checkbox"
                  checked={layout.keepHeadings}
                  onChange={(event) =>
                    onLayoutChange({ ...layout, keepHeadings: event.target.checked })
                  }
                  className="mt-1"
                />
                <span className="text-sm">
                  {t("creator.keepHeadings")}
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {t("creator.keepHeadingsDesc")}
                  </span>
                </span>
              </label>
              {stale ? (
                <p className="text-xs text-warning">{t("creator.paginationStale", { n: stale })}</p>
              ) : null}
              <div className="max-h-80 space-y-2 overflow-y-auto">
                {blocks.length ? (
                  blocks.map((block, index) => (
                    <label
                      key={block.key}
                      className="flex items-center gap-3 rounded-lg border border-border p-3"
                    >
                      <input
                        type="checkbox"
                        disabled={index === 0}
                        aria-label={`${t("creator.breakBefore")} · ${block.label}`}
                        checked={layout.breakBefore.includes(block.key)}
                        onChange={(event) =>
                          onLayoutChange({
                            ...layout,
                            breakBefore: event.target.checked
                              ? [...layout.breakBefore, block.key]
                              : layout.breakBefore.filter((key) => key !== block.key),
                          })
                        }
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm">{block.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {t("creator.blockLine", { line: block.line })}
                        </span>
                      </span>
                    </label>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">{t("creator.paginationEmpty")}</p>
                )}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => onLayoutChange({ ...layout, breakBefore: [] })}
                >
                  {t("creator.clearBreaks")}
                </Button>
                <Button onClick={() => setPanel(null)}>{t("creator.previewBack")}</Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
