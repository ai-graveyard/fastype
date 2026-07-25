export const CUSTOM_THEME_DRAFT_ID = "custom";
const CUSTOM_THEME_ID_PREFIX = "custom-";

export interface SavedCustomTheme<TStyle> {
  id: string;
  name: string;
  style: TStyle;
}

export interface CustomThemeLibrary<TStyle> {
  /** 当前选中的已保存主题；custom 表示正在创建新主题。 */
  selectedId: string | null;
  themes: SavedCustomTheme<TStyle>[];
}

export function emptyCustomThemeLibrary<TStyle>(): CustomThemeLibrary<TStyle> {
  return { selectedId: null, themes: [] };
}

export function normalizeCustomThemeName(name: string): string {
  return name.trim().slice(0, 40);
}

export function isSavedCustomThemeId(id: string): boolean {
  return id.startsWith(CUSTOM_THEME_ID_PREFIX);
}

export function createSavedCustomTheme<TStyle>(
  name: string,
  style: TStyle,
): SavedCustomTheme<TStyle> {
  const suffix = Math.random().toString(36).slice(2, 8);
  return {
    id: `${CUSTOM_THEME_ID_PREFIX}${Date.now().toString(36)}-${suffix}`,
    name: normalizeCustomThemeName(name),
    style,
  };
}

/**
 * localStorage 中的主题库必须逐项校验。坏掉的一套主题不会拖垮整个库，
 * 重复或伪造的 id 也会被丢弃。
 */
export function parseCustomThemeLibrary<TStyle>(
  raw: unknown,
  parseStyle: (value: unknown) => TStyle | null,
): CustomThemeLibrary<TStyle> | null {
  if (!raw || typeof raw !== "object") return null;
  const input = raw as { selectedId?: unknown; themes?: unknown };
  if (!Array.isArray(input.themes)) return null;

  const ids = new Set<string>();
  const themes: SavedCustomTheme<TStyle>[] = [];
  for (const item of input.themes) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as { id?: unknown; name?: unknown; style?: unknown };
    if (
      typeof candidate.id !== "string" ||
      !isSavedCustomThemeId(candidate.id) ||
      ids.has(candidate.id) ||
      typeof candidate.name !== "string"
    ) {
      continue;
    }
    const name = normalizeCustomThemeName(candidate.name);
    const style = parseStyle(candidate.style);
    if (!name || !style) continue;
    ids.add(candidate.id);
    themes.push({ id: candidate.id, name, style });
  }

  const selectedId =
    input.selectedId === CUSTOM_THEME_DRAFT_ID ||
    (typeof input.selectedId === "string" && ids.has(input.selectedId))
      ? input.selectedId
      : null;
  return { selectedId, themes };
}
