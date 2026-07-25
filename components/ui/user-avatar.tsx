import Image from "next/image";
import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

export function UserAvatar({
  src,
  name,
  className,
  style,
}: {
  src: string;
  name: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={cn(
        "relative block shrink-0 overflow-hidden rounded-full bg-white ring-1 ring-black/10",
        className,
      )}
      style={style}
    >
      <Image src={src} alt={name} fill sizes="80px" unoptimized className="object-cover" />
    </span>
  );
}
