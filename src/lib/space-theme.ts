import type { SpaceAccentColor } from "@prisma/client";

export interface SpaceAccentOption {
  value: SpaceAccentColor;
  label: string;
  colorClassName: string;
}

export const SPACE_ACCENT_OPTIONS: SpaceAccentOption[] = [
  { value: "SLATE", label: "Slate", colorClassName: "bg-neutral-400" },
  { value: "AMBER", label: "Amber", colorClassName: "bg-amber-400" },
  { value: "SKY", label: "Sky", colorClassName: "bg-sky-400" },
  { value: "EMERALD", label: "Emerald", colorClassName: "bg-emerald-400" },
  { value: "ROSE", label: "Rose", colorClassName: "bg-rose-400" },
];

interface SpaceAccentClasses {
  glowClassName: string;
  badgeClassName: string;
  borderClassName: string;
}

const SPACE_ACCENT_CLASS_MAP: Record<SpaceAccentColor, SpaceAccentClasses> = {
  SLATE: {
    glowClassName: "bg-gradient-to-br from-neutral-200/12 via-neutral-300/6 to-transparent",
    badgeClassName: "border-neutral-500/35 text-neutral-300",
    borderClassName: "hover:border-neutral-600",
  },
  AMBER: {
    glowClassName: "bg-gradient-to-br from-amber-300/16 via-amber-500/8 to-transparent",
    badgeClassName: "border-amber-500/40 text-amber-300",
    borderClassName: "hover:border-amber-500/45",
  },
  SKY: {
    glowClassName: "bg-gradient-to-br from-sky-300/16 via-sky-500/8 to-transparent",
    badgeClassName: "border-sky-500/40 text-sky-300",
    borderClassName: "hover:border-sky-500/45",
  },
  EMERALD: {
    glowClassName: "bg-gradient-to-br from-emerald-300/16 via-emerald-500/8 to-transparent",
    badgeClassName: "border-emerald-500/40 text-emerald-300",
    borderClassName: "hover:border-emerald-500/45",
  },
  ROSE: {
    glowClassName: "bg-gradient-to-br from-rose-300/16 via-rose-500/8 to-transparent",
    badgeClassName: "border-rose-500/40 text-rose-300",
    borderClassName: "hover:border-rose-500/45",
  },
};

export function getSpaceAccentClasses(accentColor: SpaceAccentColor): SpaceAccentClasses {
  return SPACE_ACCENT_CLASS_MAP[accentColor];
}
