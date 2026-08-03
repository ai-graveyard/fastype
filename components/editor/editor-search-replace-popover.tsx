"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Replace,
  ReplaceAll,
  Search,
  X,
} from "lucide-react";
import * as React from "react";

import type { EditorApi, EditorSearchStatus } from "@/components/editor/markdown-editor";
import { useT } from "@/components/providers/prefs-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import { useImeGuard } from "@/hooks/use-ime-guard";
import { cn } from "@/lib/utils";

interface EditorSearchReplacePopoverProps {
  editorRef: React.RefObject<EditorApi | null>;
}

const EMPTY_STATUS: EditorSearchStatus = { current: 0, count: 0 };

/** LovType 同款搜索与替换浮层，三个工作区共用这一份。 */
export function EditorSearchReplacePopover({ editorRef }: EditorSearchReplacePopoverProps) {
  const t = useT();
  const [open, setOpen] = React.useState(false);
  const [replaceOpen, setReplaceOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [replacement, setReplacement] = React.useState("");
  const [status, setStatus] = React.useState<EditorSearchStatus>(EMPTY_STATUS);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const ime = useImeGuard();

  const normalizedQuery = query.trim();
  const hasQuery = normalizedQuery.length > 0;
  const hasMatches = status.count > 0;

  React.useEffect(() => {
    const api = editorRef.current;
    if (!api) return;
    const unsubscribePanel = api.subscribeSearchPanel(setOpen);
    const unsubscribeUpdate = api.subscribeSearchUpdate(() => {
      if (open) setStatus(api.getSearchStatus());
    });
    return () => {
      unsubscribePanel();
      unsubscribeUpdate();
    };
  }, [editorRef, open]);

  React.useEffect(() => {
    if (!open) return;
    setStatus(editorRef.current?.configureSearch(normalizedQuery, replacement) ?? EMPTY_STATUS);
  }, [editorRef, normalizedQuery, open, replacement]);

  React.useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) editorRef.current?.closeSearch();
  };

  const navigate = (direction: "previous" | "next") => {
    setStatus(editorRef.current?.navigateSearch(direction) ?? EMPTY_STATUS);
  };

  const replaceCurrent = () => {
    setStatus(editorRef.current?.replaceCurrentSearch() ?? EMPTY_STATUS);
  };

  const replaceAll = () => {
    setStatus(editorRef.current?.replaceAllSearch() ?? EMPTY_STATUS);
  };

  return (
    <PopoverPrimitive.Root open={open}>
      <PopoverPrimitive.Anchor asChild>
        <span className="inline-flex">
          <Tooltip label={t("editor.find")}>
            <Button
              variant={open ? "default" : "ghost"}
              size="icon-sm"
              className="size-7 rounded-full"
              aria-label={t("editor.find")}
              aria-pressed={open}
              onClick={() => handleOpenChange(!open)}
            >
              <Search />
            </Button>
          </Tooltip>
        </span>
      </PopoverPrimitive.Anchor>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={8}
          collisionPadding={8}
          className={cn(
            "z-50 w-[23rem] max-w-[calc(100vw-1rem)] rounded-xl border border-border bg-popover p-2 text-popover-foreground shadow-lg outline-none",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          )}
          onInteractOutside={() => handleOpenChange(false)}
          onEscapeKeyDown={() => handleOpenChange(false)}
        >
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute left-0.5 top-1/2 z-10 size-7 -translate-y-1/2 text-muted-foreground"
                onClick={() => setReplaceOpen((value) => !value)}
                aria-label={t(replaceOpen ? "editor.collapseReplace" : "editor.expandReplace")}
                title={t(replaceOpen ? "editor.collapseReplace" : "editor.expandReplace")}
              >
                {replaceOpen ? <ChevronDown /> : <ChevronRight />}
              </Button>
              <Input
                ref={searchInputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                {...ime.compositionProps}
                onKeyDown={(event) => {
                  // 输入中文搜索词时，确认候选词的回车不该顺带跳到下一个匹配。
                  if (ime.isComposing(event)) return;
                  if (event.key === "Enter") navigate(event.shiftKey ? "previous" : "next");
                  if (event.key === "Escape") handleOpenChange(false);
                }}
                placeholder={t("editor.searchPlaceholder")}
                className="h-8 pl-8 pr-16"
              />
              {hasQuery ? (
                <span
                  className={cn(
                    "pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded bg-muted px-1.5 py-0.5 text-[11px] leading-none text-muted-foreground tabular-nums",
                    !hasMatches && "text-destructive",
                  )}
                  title={!hasMatches ? t("editor.searchNoResults") : undefined}
                >
                  {hasMatches ? `${status.current}/${status.count}` : "0/0"}
                </span>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <div className="flex h-8 overflow-hidden rounded-md border border-border bg-muted/40">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="size-8 rounded-none"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => navigate("previous")}
                  disabled={!hasMatches}
                  aria-label={t("editor.previousMatch")}
                  title={t("editor.previousMatch")}
                >
                  <ArrowUp />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="size-8 rounded-none border-l border-border"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => navigate("next")}
                  disabled={!hasMatches}
                  aria-label={t("editor.nextMatch")}
                  title={t("editor.nextMatch")}
                >
                  <ArrowDown />
                </Button>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="size-8 text-muted-foreground"
                onClick={() => handleOpenChange(false)}
                aria-label={t("editor.closeSearch")}
                title={t("editor.closeSearch")}
              >
                <X />
              </Button>
            </div>
          </div>

          {replaceOpen ? (
            <div className="mt-2 flex items-center gap-2">
              <Input
                value={replacement}
                onChange={(event) => setReplacement(event.target.value)}
                {...ime.compositionProps}
                onKeyDown={(event) => {
                  if (ime.isComposing(event)) return;
                  if (event.key === "Enter") replaceCurrent();
                  if (event.key === "Escape") handleOpenChange(false);
                }}
                placeholder={t("editor.replacePlaceholder")}
                className="h-8 min-w-0 flex-1"
              />
              <div className="flex h-8 shrink-0 overflow-hidden rounded-md border border-border bg-muted/40">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="size-8 rounded-none"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={replaceCurrent}
                  disabled={!hasMatches}
                  aria-label={t("editor.replaceOne")}
                  title={t("editor.replaceOne")}
                >
                  <Replace />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="size-8 rounded-none border-l border-border"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={replaceAll}
                  disabled={!hasMatches}
                  aria-label={t("editor.replaceAll")}
                  title={t("editor.replaceAll")}
                >
                  <ReplaceAll />
                </Button>
              </div>
            </div>
          ) : null}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
