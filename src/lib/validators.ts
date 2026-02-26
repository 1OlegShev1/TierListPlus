import { z } from "zod/v4";

export const createTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

export const updateTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
});

export const addTemplateItemSchema = z.object({
  label: z.string().min(1).max(100),
  imageUrl: z.string().min(1),
  sortOrder: z.number().int().min(0).optional(),
});

export const updateTemplateItemSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  imageUrl: z.string().min(1).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const tierConfigSchema = z.array(
  z.object({
    key: z.string().min(1).max(10),
    label: z.string().min(1).max(20),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    sortOrder: z.number().int().min(0),
  })
);

export const createSessionSchema = z.object({
  templateId: z.string().min(1),
  name: z.string().min(1).max(100),
  tierConfig: tierConfigSchema.optional(),
  bracketEnabled: z.boolean().optional(),
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
    })
  ),
});

export const bracketVoteSchema = z.object({
  matchupId: z.string().min(1),
  participantId: z.string().min(1),
  chosenItemId: z.string().min(1),
});

export const updateSessionSchema = z.object({
  status: z.enum(["OPEN", "CLOSED", "ARCHIVED"]).optional(),
  tierConfig: tierConfigSchema.optional(),
});
