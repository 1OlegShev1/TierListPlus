import { customAlphabet } from "nanoid";

// Excludes I, O, 0, 1 to avoid confusion
export const generateJoinCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 8);
export const generateSpaceInviteCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 10);
