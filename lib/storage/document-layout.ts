import { createLocalStore } from "@/lib/storage/store";
import { StorageKey } from "@/lib/storage/keys";

export interface DocumentLayout {
  breakBefore: string[];
  keepHeadings: boolean;
}
export const DEFAULT_DOCUMENT_LAYOUT: DocumentLayout = { breakBefore: [], keepHeadings: true };
export function parseDocumentLayout(raw: unknown): DocumentLayout | null {
  if (!raw || typeof raw !== "object") return null;
  const input = raw as Partial<DocumentLayout>;
  return {
    breakBefore: Array.isArray(input.breakBefore)
      ? input.breakBefore
          .filter((key): key is string => typeof key === "string" && key.length < 100)
          .slice(0, 200)
      : [],
    keepHeadings: input.keepHeadings !== false,
  };
}
export const documentLayoutStore = createLocalStore(
  StorageKey.documentLayout,
  parseDocumentLayout,
  DEFAULT_DOCUMENT_LAYOUT,
);
