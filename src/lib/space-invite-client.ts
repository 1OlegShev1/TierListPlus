import { apiFetch, apiPost } from "@/lib/api-client";

export interface PrivateSpaceInvitePayload {
  code: string;
  expiresAt: string;
  createdAt?: string;
}

export async function fetchPrivateSpaceInvite(
  spaceId: string,
): Promise<PrivateSpaceInvitePayload | null> {
  const payload = await apiFetch<{ invite: PrivateSpaceInvitePayload | null }>(
    `/api/spaces/${spaceId}/invite`,
  );
  return payload.invite;
}

export function rotatePrivateSpaceInvite(spaceId: string): Promise<PrivateSpaceInvitePayload> {
  return apiPost<PrivateSpaceInvitePayload>(`/api/spaces/${spaceId}/invite`, {});
}
