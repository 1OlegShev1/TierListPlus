import type { SpaceAccentColor } from "@prisma/client";

export interface SpaceAccentOption {
  value: SpaceAccentColor;
  label: string;
  colorClassName: string;
}

export const SPACE_ACCENT_OPTIONS: SpaceAccentOption[] = [
  { value: "SLATE", label: "Slate", colorClassName: "bg-[rgb(163_163_163)]" },
  { value: "AMBER", label: "Amber", colorClassName: "bg-[rgb(251_191_36)]" },
  { value: "SKY", label: "Sky", colorClassName: "bg-[rgb(56_189_248)]" },
  { value: "EMERALD", label: "Emerald", colorClassName: "bg-[rgb(52_211_153)]" },
  { value: "ROSE", label: "Rose", colorClassName: "bg-[rgb(251_113_133)]" },
  { value: "SILVER", label: "Silver", colorClassName: "bg-[rgb(212_212_216)]" },
  { value: "ORANGE", label: "Orange", colorClassName: "bg-[rgb(251_146_60)]" },
  { value: "CYAN", label: "Cyan", colorClassName: "bg-[rgb(34_211_238)]" },
  { value: "TEAL", label: "Teal", colorClassName: "bg-[rgb(45_212_191)]" },
  { value: "PINK", label: "Pink", colorClassName: "bg-[rgb(244_114_182)]" },
];

interface SpaceAccentClasses {
  glowClassName: string;
  badgeClassName: string;
  borderClassName: string;
}

const SPACE_ACCENT_CLASS_MAP: Record<SpaceAccentColor, SpaceAccentClasses> = {
  SLATE: {
    glowClassName:
      "bg-[linear-gradient(135deg,rgba(229,229,229,0.12)_0%,rgba(163,163,163,0.06)_55%,transparent_100%)]",
    badgeClassName: "border-[rgb(163_163_163_/_0.35)] text-[rgb(212_212_212)]",
    borderClassName: "hover:border-[rgb(163_163_163_/_0.45)]",
  },
  AMBER: {
    glowClassName:
      "bg-[linear-gradient(135deg,rgba(253,230,138,0.16)_0%,rgba(245,158,11,0.08)_55%,transparent_100%)]",
    badgeClassName: "border-[rgb(245_158_11_/_0.4)] text-[rgb(253_230_138)]",
    borderClassName: "hover:border-[rgb(245_158_11_/_0.45)]",
  },
  SKY: {
    glowClassName:
      "bg-[linear-gradient(135deg,rgba(125,211,252,0.16)_0%,rgba(14,165,233,0.08)_55%,transparent_100%)]",
    badgeClassName: "border-[rgb(14_165_233_/_0.4)] text-[rgb(125_211_252)]",
    borderClassName: "hover:border-[rgb(14_165_233_/_0.45)]",
  },
  EMERALD: {
    glowClassName:
      "bg-[linear-gradient(135deg,rgba(110,231,183,0.16)_0%,rgba(16,185,129,0.08)_55%,transparent_100%)]",
    badgeClassName: "border-[rgb(16_185_129_/_0.4)] text-[rgb(110_231_183)]",
    borderClassName: "hover:border-[rgb(16_185_129_/_0.45)]",
  },
  ROSE: {
    glowClassName:
      "bg-[linear-gradient(135deg,rgba(253,164,175,0.16)_0%,rgba(244,63,94,0.08)_55%,transparent_100%)]",
    badgeClassName: "border-[rgb(244_63_94_/_0.4)] text-[rgb(253_164_175)]",
    borderClassName: "hover:border-[rgb(244_63_94_/_0.45)]",
  },
  SILVER: {
    glowClassName:
      "bg-[linear-gradient(135deg,rgba(228,228,231,0.16)_0%,rgba(161,161,170,0.08)_55%,transparent_100%)]",
    badgeClassName: "border-[rgb(161_161_170_/_0.4)] text-[rgb(228_228_231)]",
    borderClassName: "hover:border-[rgb(161_161_170_/_0.45)]",
  },
  ORANGE: {
    glowClassName:
      "bg-[linear-gradient(135deg,rgba(253,186,116,0.16)_0%,rgba(249,115,22,0.08)_55%,transparent_100%)]",
    badgeClassName: "border-[rgb(249_115_22_/_0.4)] text-[rgb(253_186_116)]",
    borderClassName: "hover:border-[rgb(249_115_22_/_0.45)]",
  },
  CYAN: {
    glowClassName:
      "bg-[linear-gradient(135deg,rgba(103,232,249,0.16)_0%,rgba(6,182,212,0.08)_55%,transparent_100%)]",
    badgeClassName: "border-[rgb(6_182_212_/_0.4)] text-[rgb(103_232_249)]",
    borderClassName: "hover:border-[rgb(6_182_212_/_0.45)]",
  },
  TEAL: {
    glowClassName:
      "bg-[linear-gradient(135deg,rgba(94,234,212,0.16)_0%,rgba(20,184,166,0.08)_55%,transparent_100%)]",
    badgeClassName: "border-[rgb(20_184_166_/_0.4)] text-[rgb(94_234_212)]",
    borderClassName: "hover:border-[rgb(20_184_166_/_0.45)]",
  },
  PINK: {
    glowClassName:
      "bg-[linear-gradient(135deg,rgba(249,168,212,0.16)_0%,rgba(236,72,153,0.08)_55%,transparent_100%)]",
    badgeClassName: "border-[rgb(236_72_153_/_0.4)] text-[rgb(249_168_212)]",
    borderClassName: "hover:border-[rgb(236_72_153_/_0.45)]",
  },
};

export function getSpaceAccentClasses(accentColor: SpaceAccentColor): SpaceAccentClasses {
  return SPACE_ACCENT_CLASS_MAP[accentColor];
}
