/** 文件读写全部走浏览器能力，没有任何服务端参与（PRD 9.1）。 */

/** 保存时一律用 `.md`；`.markdown` / `.txt` 只是允许被打开和拖入。 */
export const ACCEPTED_EXTENSIONS = [".md", ".markdown", ".txt"] as const;

export function hasAcceptedExtension(name: string): boolean {
  const lower = name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export type OpenFileResult =
  | { ok: true; name: string; content: string; handle?: FileSystemFileHandle }
  | { ok: false; reason: "unsupportedType" | "decodeFailed" | "readFailed"; name: string; detail?: string };

/** UTF-8 严格解码：解不出来说明不是文本或用了别的编码，明确报错而不是显示乱码。 */
export async function readTextFile(
  file: File,
  handle?: FileSystemFileHandle,
): Promise<OpenFileResult> {
  if (!hasAcceptedExtension(file.name)) {
    return { ok: false, reason: "unsupportedType", name: file.name };
  }
  let buffer: ArrayBuffer;
  try {
    buffer = await file.arrayBuffer();
  } catch (error) {
    return {
      ok: false,
      reason: "readFailed",
      name: file.name,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
  try {
    const content = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    return { ok: true, name: file.name, content, handle };
  } catch {
    return { ok: false, reason: "decodeFailed", name: file.name };
  }
}

interface FilePickerOptions {
  types?: Array<{ description: string; accept: Record<string, string[]> }>;
  suggestedName?: string;
}

interface FileSystemWindow extends Window {
  showOpenFilePicker?: (options?: FilePickerOptions & { multiple?: boolean }) => Promise<FileSystemFileHandle[]>;
  showSaveFilePicker?: (options?: FilePickerOptions) => Promise<FileSystemFileHandle>;
}

export function supportsFileSystemAccess(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as FileSystemWindow).showSaveFilePicker === "function"
  );
}

const MARKDOWN_PICKER_TYPES = [
  {
    description: "Markdown",
    accept: {
      "text/markdown": [".md", ".markdown"],
      "text/plain": [".txt"],
    },
  },
];

/** 优先用 File System Access API 拿到 handle，这样之后能直接写回原文件。 */
export async function pickFile(): Promise<
  { ok: true; file: File; handle?: FileSystemFileHandle } | { ok: false; canceled: true }
> {
  const win = window as FileSystemWindow;
  if (typeof win.showOpenFilePicker === "function") {
    try {
      const [handle] = await win.showOpenFilePicker({ types: MARKDOWN_PICKER_TYPES });
      if (!handle) return { ok: false, canceled: true };
      const file = await handle.getFile();
      // 自动保存发生在定时器中，届时浏览器已没有用户手势，无法再弹写权限确认。
      // 因此在“打开”这个用户操作里提前请求；拒绝时仍正常打开，只保存本地草稿。
      let canWrite = false;
      try {
        canWrite = await queryWritePermission(handle);
      } catch {
        // 部分浏览器要求更严格的瞬时用户激活，拿不到写权限时安全降级。
      }
      return { ok: true, file, ...(canWrite ? { handle } : {}) };
    } catch {
      // 用户取消，或浏览器在非安全上下文里拒绝，都退回到 <input type="file">。
      return { ok: false, canceled: true };
    }
  }
  return { ok: false, canceled: true };
}

export type SaveOutcome =
  | { ok: true; wroteToFile: true; handle: FileSystemFileHandle }
  | { ok: true; wroteToFile: false }
  | { ok: false; canceled: true }
  | { ok: false; canceled: false; detail: string };

/** 写回已授权的 handle。没有 handle 或浏览器不支持时由调用方降级为下载。 */
export async function writeToHandle(
  handle: FileSystemFileHandle,
  content: string,
): Promise<SaveOutcome> {
  try {
    const permission = await queryWritePermission(handle);
    if (!permission) return { ok: false, canceled: true };
    const writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();
    return { ok: true, wroteToFile: true, handle };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return { ok: false, canceled: true };
    }
    return {
      ok: false,
      canceled: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

interface PermissionCapableHandle extends FileSystemFileHandle {
  queryPermission?: (descriptor: { mode: "readwrite" }) => Promise<PermissionState>;
  requestPermission?: (descriptor: { mode: "readwrite" }) => Promise<PermissionState>;
}

async function queryWritePermission(handle: FileSystemFileHandle): Promise<boolean> {
  const capable = handle as PermissionCapableHandle;
  if (typeof capable.queryPermission !== "function") return true;
  const current = await capable.queryPermission({ mode: "readwrite" });
  if (current === "granted") return true;
  if (typeof capable.requestPermission !== "function") return false;
  return (await capable.requestPermission({ mode: "readwrite" })) === "granted";
}

/** 「另存为」：拿到新 handle 并写入，用户之后可以继续写回这个文件。 */
export async function saveWithPicker(
  content: string,
  suggestedName: string,
): Promise<SaveOutcome> {
  const win = window as FileSystemWindow;
  if (typeof win.showSaveFilePicker !== "function") return { ok: true, wroteToFile: false };
  try {
    const handle = await win.showSaveFilePicker({
      suggestedName,
      types: MARKDOWN_PICKER_TYPES,
    });
    return writeToHandle(handle, content);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return { ok: false, canceled: true };
    }
    return { ok: true, wroteToFile: false };
  }
}

/** 一致的降级方案：任何浏览器都能下载（PRD FT-DOC-003）。 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // 立刻 revoke 会让部分浏览器取消下载，留一帧余量。
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function downloadText(content: string, filename: string, mime = "text/markdown"): void {
  downloadBlob(new Blob([content], { type: `${mime};charset=utf-8` }), filename);
}

/** 文件名清洗：去掉路径分隔符和控制字符，保证下载名合法。 */
const ILLEGAL_FILENAME_CHARS = new RegExp("[\\u0000-\\u001f<>:\"/\\\\|?*]", "g");

export function sanitizeFilename(name: string, fallback: string): string {
  // 去掉开头的点：避免拼出 `.` / `..` / 隐藏文件这类看起来像路径操作符的名字。
  const cleaned = name.replace(ILLEGAL_FILENAME_CHARS, "").trim().replace(/^\.+/, "");
  return cleaned || fallback;
}

export function baseName(filename: string): string {
  return filename.replace(/\.(md|markdown|txt)$/i, "");
}

export function ensureMarkdownExtension(name: string): string {
  return hasAcceptedExtension(name) ? name : `${name}.md`;
}
