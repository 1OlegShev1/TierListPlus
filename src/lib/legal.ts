export const LEGAL_LAST_UPDATED = "March 9, 2026";

export const LEGAL_SERVICE_NAME = process.env.NEXT_PUBLIC_LEGAL_SERVICE_NAME?.trim() || "TierList+";
export const LEGAL_ENTITY_NAME = process.env.NEXT_PUBLIC_LEGAL_ENTITY_NAME?.trim() || "TierList+";
export const LEGAL_CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_LEGAL_CONTACT_EMAIL?.trim() || "legal@tierlistplus.com";
export const LEGAL_PRIVACY_EMAIL =
  process.env.NEXT_PUBLIC_LEGAL_PRIVACY_EMAIL?.trim() || LEGAL_CONTACT_EMAIL;
export const LEGAL_COPYRIGHT_EMAIL =
  process.env.NEXT_PUBLIC_LEGAL_COPYRIGHT_EMAIL?.trim() || LEGAL_CONTACT_EMAIL;
