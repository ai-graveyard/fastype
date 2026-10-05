import { parseDraft, type Draft } from "@/lib/prefs";
import { readRecord, SCHEMA_VERSION, StorageKey } from "@/lib/storage";

export interface DraftSnapshot extends Draft {
  id: string;
}
export const HISTORY_LIMIT = 12;
const HISTORY_BUDGET = 600_000;

export function parseHistory(raw: unknown): DraftSnapshot[] | null {
  if (!Array.isArray(raw)) return null;
  return raw
    .flatMap((value) => {
      const draft = parseDraft(value);
      if (!draft || !draft.content.trim() || typeof value.id !== "string") return [];
      return [{ ...draft, id: value.id }];
    })
    .slice(0, HISTORY_LIMIT);
}

export function readHistory(): DraftSnapshot[] {
  return readRecord(StorageKey.history, parseHistory, []).value;
}

export function addSnapshot(history: DraftSnapshot[], draft: Draft): DraftSnapshot[] {
  if (!draft.content.trim() || history[0]?.content === draft.content) return history;
  const next = [
    { ...draft, id: `${draft.savedAt}-${Math.random().toString(36).slice(2, 8)}` },
    ...history,
  ].slice(0, HISTORY_LIMIT);
  while (next.length && JSON.stringify(next).length > HISTORY_BUDGET) next.pop();
  return next;
}

/** Optional history must never exhaust the draft writer's quota or replace its last good record. */
export function saveSnapshot(draft: Draft): boolean {
  const next = addSnapshot(readHistory(), draft);
  while (next.length) {
    try {
      window.localStorage.setItem(
        StorageKey.history,
        JSON.stringify({ v: SCHEMA_VERSION, data: next }),
      );
      return true;
    } catch {
      next.pop();
    }
  }
  return false;
}

export function isMajorReplacement(before: string, after: string): boolean {
  if (!before || before === after) return false;
  let prefix = 0;
  while (prefix < Math.min(before.length, after.length) && before[prefix] === after[prefix])
    prefix++;
  let suffix = 0;
  while (
    suffix < Math.min(before.length, after.length) - prefix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  )
    suffix++;
  const removed = before.length - prefix - suffix;
  return removed >= Math.min(80, before.length) && removed >= before.length / 4;
}
