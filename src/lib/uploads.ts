const PRIMARY_UPLOAD_FILENAME_RE = /^([A-Za-z0-9_-]+)\.(webp|gif)$/i;
export const MANAGED_UPLOAD_URL_RE = /^\/uploads\/([A-Za-z0-9_-]+\.(?:webp|gif))$/i;
export const MANAGED_WEBP_UPLOAD_URL_RE = /^\/uploads\/([A-Za-z0-9_-]+\.webp)$/i;
export const MANAGED_UPLOAD_FILE_RE = /^[A-Za-z0-9_-]+(?:\.poster)?\.(?:webp|gif)$/i;

export function extractManagedUploadFilename(imageUrl: string): string | null {
  const match = MANAGED_UPLOAD_URL_RE.exec(imageUrl);
  return match?.[1] ?? null;
}

export function extractManagedWebpUploadFilename(imageUrl: string): string | null {
  const match = MANAGED_WEBP_UPLOAD_URL_RE.exec(imageUrl);
  return match?.[1] ?? null;
}

export function getCompanionUploadFilenames(filename: string): string[] {
  const match = PRIMARY_UPLOAD_FILENAME_RE.exec(filename);
  if (!match) return [];

  const [, baseName, extension] = match;
  if (extension.toLowerCase() !== "gif") return [];
  return [`${baseName}.poster.webp`];
}
