export type SpaceVisibilityPolicy = "PRIVATE" | "OPEN";

export interface SpaceReadPolicyInput {
  visibility: SpaceVisibilityPolicy;
  isMember: boolean;
}

export interface SessionReadPolicyInput {
  isSpaceScoped: boolean;
  spaceVisibility: SpaceVisibilityPolicy | null;
  isSpaceMember: boolean;
  isPrivate: boolean;
  isModeratedHidden: boolean;
  isOwner: boolean;
  isParticipant: boolean;
}

export interface ResourceMutatePolicyInput {
  creatorId: string | null;
  requestUserId: string | null;
  isSpaceOwner: boolean;
}

export interface TemplateReadPolicyInput {
  isHidden: boolean;
  isModeratedHidden: boolean;
  isSpaceScoped: boolean;
  spaceVisibility: SpaceVisibilityPolicy | null;
  isSpaceMember: boolean;
  isPublic: boolean;
  isOwner: boolean;
}

export function canReadSpace(input: SpaceReadPolicyInput) {
  return input.visibility === "OPEN" || input.isMember;
}

export function canMutateResource(input: ResourceMutatePolicyInput) {
  return !!input.requestUserId && (input.creatorId === input.requestUserId || input.isSpaceOwner);
}

export function canReadSession(input: SessionReadPolicyInput) {
  if (input.isModeratedHidden && !input.isOwner && !input.isParticipant) {
    return false;
  }

  if (input.isSpaceScoped) {
    return input.spaceVisibility === "OPEN" || input.isSpaceMember;
  }

  if (!input.isPrivate) {
    return true;
  }

  return input.isOwner || input.isParticipant;
}

export function canReadTemplate(input: TemplateReadPolicyInput) {
  if (input.isHidden) {
    return false;
  }

  if (input.isModeratedHidden && !input.isOwner) {
    return false;
  }

  if (input.isSpaceScoped) {
    return input.spaceVisibility === "OPEN" || input.isSpaceMember;
  }

  if (input.isPublic) {
    return true;
  }

  return input.isOwner;
}
