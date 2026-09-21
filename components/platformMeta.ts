import type { PlatformId } from "@/types";

export const PLATFORM_META: Record<
  PlatformId,
  { label: string; bg: string; text: string; ring: string }
> = {
  blinkit: { label: "Blinkit", bg: "bg-yellow-400", text: "text-yellow-950", ring: "ring-yellow-400" },
  zepto: { label: "Zepto", bg: "bg-fuchsia-600", text: "text-white", ring: "ring-fuchsia-500" },
  instamart: { label: "Instamart", bg: "bg-orange-500", text: "text-white", ring: "ring-orange-500" },
};

export const PLATFORM_ORDER: PlatformId[] = ["blinkit", "zepto", "instamart"];
