import type { DiffSegment } from "@/lib/ai/diff";
import { cn } from "@/lib/utils";

interface AiDiffViewProps {
  segments: DiffSegment[];
  hasResult: boolean;
  emptyLabel: string;
  unchangedLabel: string;
  className?: string;
}

/** 逐词展示 AI 结果相对原文的增删，帮助用户在替换全文前确认改了哪些内容。 */
export function AiDiffView({
  segments,
  hasResult,
  emptyLabel,
  unchangedLabel,
  className,
}: AiDiffViewProps) {
  const hasChange = segments.some((segment) => segment.type !== "equal");

  if (!hasResult) {
    return (
      <div
        className={cn("flex items-center justify-center text-sm text-muted-foreground", className)}
      >
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className={cn("overflow-y-auto whitespace-pre-wrap break-words", className)}>
      {!hasChange ? <p className="mb-2 text-muted-foreground">{unchangedLabel}</p> : null}
      {segments.map((segment, index) => {
        if (segment.type === "equal") {
          return <span key={index}>{segment.value}</span>;
        }
        if (segment.type === "remove") {
          return (
            <del
              key={index}
              className="rounded-sm bg-red-500/15 text-red-700 dark:bg-red-500/20 dark:text-red-300"
            >
              {segment.value}
            </del>
          );
        }
        return (
          <ins
            key={index}
            className="rounded-sm bg-emerald-500/15 text-emerald-700 no-underline dark:bg-emerald-500/20 dark:text-emerald-300"
          >
            {segment.value}
          </ins>
        );
      })}
    </div>
  );
}
