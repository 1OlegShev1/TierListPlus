import { z } from "zod/v4";
import { MANAGED_UPLOAD_URL_RE } from "@/lib/uploads";

const spaceAccentColorSchema = z.enum([
  "SLATE",
  "AMBER",
  "SKY",
  "EMERALD",
  "ROSE",
  "SILVER",
  "ORANGE",
  "CYAN",
  "TEAL",
  "PINK",
]);

export const createTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  isPublic: z.boolean().optional(),
});

export const updateTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  isPublic: z.boolean().optional(),
});

export const addTemplateItemSchema = z.object({
  label: z.string().max(100),
  imageUrl: z.string().min(1),
  sortOrder: z.number().int().min(0).optional(),
});

export const addSessionItemSchema = addTemplateItemSchema;

export const cleanupUploadSchema = z.object({
  imageUrl: z.string().min(1),
});

export const updateTemplateItemSchema = z.object({
  label: z.string().max(100).optional(),
  imageUrl: z.string().min(1).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const updateSessionItemSchema = updateTemplateItemSchema;

export const tierConfigSchema = z.array(
  z.object({
    key: z.string().min(1).max(10),
    label: z.string().min(1).max(20),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    sortOrder: z.number().int().min(0),
  }),
);

export const createSessionSchema = z.object({
  templateId: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(100),
  tierConfig: tierConfigSchema.optional(),
  isPrivate: z.boolean().optional(),
  nickname: z.string().min(1).max(30).optional(),
});

export const joinSessionSchema = z.object({
  joinCode: z.string().min(1).max(20),
  nickname: z.string().min(1).max(30),
});

export const submitVotesSchema = z.object({
  participantId: z.string().min(1),
  votes: z.array(
    z.object({
      sessionItemId: z.string().min(1),
      tierKey: z.string().min(1),
      rankInTier: z.number().int().min(0),
    }),
  ),
});

export const updateSessionSchema = z.object({
  status: z.enum(["OPEN", "CLOSED", "ARCHIVED"]).optional(),
  isPrivate: z.boolean().optional(),
  isLocked: z.boolean().optional(),
  tierConfig: tierConfigSchema.optional(),
});

export const createSpaceSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(280).optional(),
  logoUrl: z.string().trim().regex(MANAGED_UPLOAD_URL_RE).optional(),
  accentColor: spaceAccentColorSchema.optional(),
  visibility: z.enum(["PRIVATE", "OPEN"]).optional(),
});

export const updateSpaceSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(280).optional().nullable(),
  logoUrl: z.string().trim().regex(MANAGED_UPLOAD_URL_RE).optional().nullable(),
  accentColor: spaceAccentColorSchema.optional(),
  visibility: z.enum(["PRIVATE", "OPEN"]).optional(),
});

export const joinSpaceSchema = z.object({
  code: z.string().trim().min(1).max(30),
});
