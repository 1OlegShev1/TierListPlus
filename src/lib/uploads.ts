export const MANAGED_UPLOAD_URL_RE = /^\/uploads\/([A-Za-z0-9_-]+\.webp)$/;
export const MANAGED_UPLOAD_FILE_RE = /^[A-Za-z0-9_-]+\.webp$/;

export function extractManagedUploadFilename(imageUrl: string): string | null {
  const match = MANAGED_UPLOAD_URL_RE.exec(imageUrl);
  return match?.[1] ?? null;
}
