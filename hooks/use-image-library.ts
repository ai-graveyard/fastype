"use client";

import * as React from "react";

import { isImageDataUrl } from "@/lib/image/data-url";
import {
  loadImages,
  peekImageDataUrl,
  pinImages,
  resolveImageRefValue,
  resolveImageRefs,
  saveImageDataUrl,
} from "@/lib/image/library";
import { findImageRefIds, imageRefId } from "@/lib/image/ref";

/**
 * 把正文里的图片引用换成 data URI，交给渲染。
 *
 * 从 IndexedDB 读是异步的，而 renderMarkdown 是同步纯函数，所以这里的分工是：读进
 * 会话缓存这件事放 effect，换字符串那一步始终同步走缓存。还没读上来的图先渲染成透明
 * 占位（见 lib/image/library.ts），读完再换一次，中间不会闪「图片加载失败」。
 */
export function useResolvedImages(source: string): string {
  const ids = React.useMemo(() => findImageRefIds(source), [source]);
  const [version, bump] = React.useReducer((count: number) => count + 1, 0);

  React.useEffect(() => {
    const release = pinImages(ids);
    // 全在缓存里就不用惊动 IndexedDB，也省掉一次无谓的重渲染。
    if (ids.length === 0 || ids.every((id) => peekImageDataUrl(id) !== null)) return release;
    let alive = true;
    void loadImages(ids).then(() => {
      if (alive) bump();
    });
    return () => {
      alive = false;
      release();
    };
  }, [ids]);

  return React.useMemo(
    () => resolveImageRefs(source),
    // version 只是缓存填上之后重算一次的信号，本身不参与计算。
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [source, version],
  );
}

/**
 * 设置里的图片字段（头像、公众号封面）：存的是引用，用的是 data URI。
 *
 * 和正文那条路同一套图片库，只是这里一个字段整个就是一条引用，不必在长文本里找。
 * 进出两个方向都收口在这里：
 * - 写：返回的 store() 先把内嵌 data URI 收进图片库、换成引用，再落 localStorage。
 *   不这么做就等于把刚解析出来的 data URI 又写回去，配额一点没省。字段里没有内嵌图时
 *   同步落盘，免得改个颜色、拖个滑块都要绕一趟异步。
 * - 读：引用换回 data URI 交给下游。下游包括导出 PNG 和复制到公众号的那份 HTML，
 *   它们要离开本页面，只认 data URI。
 *
 * 记录里本来就带着内嵌 data URI 的（旧版本存的、导入进来的配置）也走 store() 收口，
 * 调用方不必各自处理。
 *
 * `fields` 必须是稳定引用（放模块作用域），否则每次渲染都会重跑一遍。
 */
export function useStoredImages<T extends object>(
  record: T,
  fields: readonly (keyof T & string)[],
  save: (next: T) => void,
): [T, (next: T) => void] {
  const [version, bump] = React.useReducer((count: number) => count + 1, 0);
  const saveRef = React.useRef(save);
  const conversionVersion = React.useRef(0);
  React.useEffect(() => {
    saveRef.current = save;
  });

  const hasInline = React.useCallback(
    (value: T) => fields.some((name) => isImageDataUrl(readField(value, name))),
    [fields],
  );

  /** 换成功了给新的一份，一张都没换成（图片库用不了）给 null。 */
  const toRefs = React.useCallback(
    async (value: T): Promise<T | null> => {
      const converted = { ...value };
      let changed = false;
      for (const name of fields) {
        if (!isImageDataUrl(readField(value, name))) continue;
        const ref = await saveImageDataUrl(readField(value, name));
        // 存不进去（无痕模式等）就让 data URI 留在原地：功能照常，只是继续占 localStorage。
        if (!ref) continue;
        writeField(converted, name, ref);
        changed = true;
      }
      return changed ? converted : null;
    },
    [fields],
  );

  const store = React.useCallback(
    (next: T) => {
      const operation = ++conversionVersion.current;
      // 没有内嵌图就同步落盘，免得改个颜色、拖个滑块都要绕一趟异步。
      if (!hasInline(next)) {
        saveRef.current(next);
        return;
      }
      // 换不成引用也要照存：用户按的是保存，不能因为图片库用不了就把这次改动吞掉。
      void toRefs(next).then((converted) => {
        // 后发的设置已经保存时，旧转换结果不能把整条旧记录覆盖回来。
        if (operation === conversionVersion.current) saveRef.current(converted ?? next);
      });
    },
    [hasInline, toRefs],
  );

  React.useEffect(() => {
    if (!hasInline(record)) return;
    const operation = ++conversionVersion.current;
    /*
     * 只有真换成引用了才写回。图片库用不了时原样写回，会让记录换一个新的对象身份，
     * 这个 effect 又被触发一次，如此往复——一个转不出去的死循环。
     *
     * 同一张图重复入库会被图片库按内容挡掉，所以不怕和 store() 那条路撞车。
     */
    void toRefs(record).then((converted) => {
      if (converted && operation === conversionVersion.current) saveRef.current(converted);
    });
  }, [record, hasInline, toRefs]);

  const ids = React.useMemo(
    () =>
      fields
        .map((name) => imageRefId(readField(record, name)))
        .filter((id): id is string => id !== null),
    [record, fields],
  );

  React.useEffect(() => {
    const release = pinImages(ids);
    if (ids.length === 0 || ids.every((id) => peekImageDataUrl(id) !== null)) return release;
    let alive = true;
    void loadImages(ids).then(() => {
      if (alive) bump();
    });
    return () => {
      alive = false;
      release();
    };
  }, [ids]);

  const resolved = React.useMemo(
    () => {
      // 没有要换的就原样返回，保住引用相等，别让下游的 memo 白白失效。
      let next: T | null = null;
      for (const name of fields) {
        const value = readField(record, name);
        const swapped = imageRefId(value) ? resolveImageRefValue(value) : resolveImageRefs(value);
        if (swapped === value) continue;
        next ??= { ...record };
        writeField(next, name, swapped);
      }
      return next ?? record;
    },
    // version 同上：缓存填上之后重算一次的信号。
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [record, fields, version],
  );

  return [resolved, store];
}

/** 非字符串字段一律当空串，后面的判断（是不是 data URI、是不是引用）就都不必再挡一次。 */
function readField(record: object, name: string): string {
  const value = (record as Record<string, unknown>)[name];
  return typeof value === "string" ? value : "";
}

function writeField(record: object, name: string, value: string): void {
  (record as Record<string, unknown>)[name] = value;
}
