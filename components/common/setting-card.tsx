import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * 设置面板里的一张卡片：标题 + 说明 + 右上角操作位 + 内容。
 * 小红书和公众号两个工作区的设置项都用它，`id` 供目录锚点跳转。
 */
export function SettingCard({
  id,
  title,
  description,
  action,
  className,
  children,
}: {
  id?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={cn("scroll-mt-4 space-y-4 rounded-lg border border-border bg-card p-4", className)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{title}</h3>
          {description ? (
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
