/**
 * localStorage 键位。
 *
 * 草稿与普通设置分开存储（PRD FT-SET-001），这样清除样式或 AI 配置时不会误删正文。
 * 每条记录都带结构版本号，读到旧版本或损坏数据时安全降级。
 */
export const STORAGE_PREFIX = "fastype";

export const StorageKey = {
  /** 正文与文件名，独立于其它设置。 */
  draft: `${STORAGE_PREFIX}:draft`,
  /** 语言、主题、上次视图、分栏比例。 */
  prefs: `${STORAGE_PREFIX}:prefs`,
  /** 小红书样式。 */
  xhsStyle: `${STORAGE_PREFIX}:style:xhs`,
  /** 小红书已保存的自定义主题。 */
  xhsThemes: `${STORAGE_PREFIX}:themes:xhs`,
  /** 公众号样式。 */
  wechatStyle: `${STORAGE_PREFIX}:style:wechat`,
  /** 公众号横版/方形封面及本地裁剪结果。 */
  wechatCover: `${STORAGE_PREFIX}:cover:wechat`,
  /** 公众号已保存的自定义主题。 */
  wechatThemes: `${STORAGE_PREFIX}:themes:wechat`,
  /** BYOK 模型配置（含 API Key）。 */
  ai: `${STORAGE_PREFIX}:ai`,
  /** 预览区展示的用户头像、名称与 slogan。 */
  userProfile: `${STORAGE_PREFIX}:user-profile`,
} as const;

export type StorageKeyName = keyof typeof StorageKey;

export const ALL_STORAGE_KEYS = Object.values(StorageKey);

/** 当前结构版本，破坏性变更时 +1。 */
export const SCHEMA_VERSION = 1;
