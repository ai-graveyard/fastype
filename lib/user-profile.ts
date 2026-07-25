export interface UserProfile {
  avatar: string;
  name: string;
  slogan: string;
}

export const DEFAULT_USER_PROFILE: UserProfile = {
  avatar: "/fastype-logo.png",
  name: "FasType",
  slogan: "一分钟快速多平台排版",
};

const MAX_NAME_LENGTH = 24;
const MAX_SLOGAN_LENGTH = 60;

/** 用户资料只接受本地品牌图或浏览器生成的安全位图 data URL。 */
export function parseUserProfile(raw: unknown): UserProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const input = raw as Partial<UserProfile>;
  const avatar =
    typeof input.avatar === "string" &&
    (input.avatar === DEFAULT_USER_PROFILE.avatar ||
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
