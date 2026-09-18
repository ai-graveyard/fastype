import { isImageRef } from "@/lib/image/ref";
import { translate, type Locale } from "@/lib/i18n";

export interface UserProfile {
  avatar: string;
  name: string;
  slogan: string;
}

export function getDefaultUserProfile(locale: Locale): UserProfile {
  return {
    avatar: "/fastype-logo.png",
    name: "FasType",
    slogan: translate(locale, "profile.defaultSlogan"),
  };
}

export const DEFAULT_USER_PROFILE: UserProfile = getDefaultUserProfile("zh");

const MAX_NAME_LENGTH = 24;
const MAX_SLOGAN_LENGTH = 60;

/**
 * 用户资料只接受三种头像：本地品牌图、指向图片库的引用、浏览器生成的安全位图 data URL。
 *
 * 存下来的正常形态是引用（图片本体在 IndexedDB 里）；data URL 这一路留着是因为旧版本
 * 就是这么存的，还有导入进来的配置也是这个形态，读进来之后再换成引用。
 */
export function parseUserProfile(raw: unknown): UserProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const input = raw as Partial<UserProfile>;
  const avatar =
    typeof input.avatar === "string" &&
    (input.avatar === DEFAULT_USER_PROFILE.avatar ||
      isImageRef(input.avatar) ||
      /^data:image\/(?:png|jpeg|webp);base64,/i.test(input.avatar))
      ? input.avatar
      : DEFAULT_USER_PROFILE.avatar;

  return {
    avatar,
    name:
      typeof input.name === "string" && input.name.trim()
        ? input.name.trim().slice(0, MAX_NAME_LENGTH)
        : DEFAULT_USER_PROFILE.name,
    slogan:
      typeof input.slogan === "string" && input.slogan.trim()
        ? input.slogan.trim().slice(0, MAX_SLOGAN_LENGTH)
        : DEFAULT_USER_PROFILE.slogan,
  };
}
