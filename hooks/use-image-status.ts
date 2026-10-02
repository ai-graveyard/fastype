"use client";

import * as React from "react";

/**
 * 远程图片加载状态（PRD FT-IMG-001）。
 *
 * 单张图片失败只把自己变成占位，不影响其它内容的预览和导出。
 */
export function useImageFallback(
  containerRef: React.RefObject<HTMLElement | null>,
  failedLabel: string,
  deps: unknown[] = [],
) {
  const [failed, setFailed] = React.useState<string[]>([]);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const broken = new Set<string>();

    const mark = (img: HTMLImageElement) => {
      const src = img.getAttribute("src") ?? "";
      if (src) broken.add(src);
      img.dataset.ftFailed = "true";
      img.style.display = "none";
      if (img.nextElementSibling?.classList.contains("md-img-error")) return;
      const placeholder = document.createElement("span");
      placeholder.className = "md-img-error";
      placeholder.textContent = `${failedLabel}${src ? ` · ${src}` : ""}`;
      img.after(placeholder);
      setFailed([...broken]);
    };

    const onError = (event: Event) => {
      const target = event.target;
      if (target instanceof HTMLImageElement) mark(target);
    };

    // error 事件不冒泡，必须用捕获阶段。
    container.addEventListener("error", onError, true);
    container.querySelectorAll("img").forEach((img) => {
      if (img.complete && img.naturalWidth === 0) mark(img);
    });

    return () => container.removeEventListener("error", onError, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef, failedLabel, ...deps]);

  return failed;
}

/**
 * 等待容器内所有图片 settle（成功或失败）。
 * 小红书分页必须在图片有真实高度之后才准确。
 */
export function useImagesSettled(
  containerRef: React.RefObject<HTMLElement | null>,
  html: string,
): number {
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const dimensions = (images: HTMLImageElement[]) => {
      if (images.some((image) => !image.complete)) return null;
      return JSON.stringify(
        images.map((image) => [image.src, image.naturalWidth, image.naturalHeight]),
      );
    };
    let lastImages = Array.from(container.querySelectorAll("img"));
    let lastDimensions = dimensions(lastImages);
    const settle = () => {
      const images = Array.from(container.querySelectorAll("img"));
      const next = dimensions(images);
      const sameNodes =
        images.length === lastImages.length &&
        images.every((image, index) => image === lastImages[index]);
      if (next === null || (sameNodes && next === lastDimensions)) return;
      lastImages = images;
      lastDimensions = next;
      setTick((value) => value + 1);
    };

    // 字体或样式变化会替换测量节点；监听容器才能收到新图片事件。
    // 同一批节点的重复事件不触发重排；新节点即使命中缓存也要重新确认布局。
    container.addEventListener("load", settle, true);
    container.addEventListener("error", settle, true);
    return () => {
      container.removeEventListener("load", settle, true);
      container.removeEventListener("error", settle, true);
    };
  }, [containerRef, html]);

  return tick;
}
