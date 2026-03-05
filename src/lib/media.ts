const MANAGED_GIF_UPLOAD_RE = /^\/uploads\/([A-Za-z0-9_-]+)\.gif$/i;
const GIF_EXT_RE = /\.gif(?:$|[?#])/i;

function splitUrlSuffix(url: string): { pathname: string; suffix: string } {
  const suffixStart = url.search(/[?#]/);
  if (suffixStart < 0) {
    return { pathname: url, suffix: "" };
  }

  return {
    pathname: url.slice(0, suffixStart),
    suffix: url.slice(suffixStart),
  };
}

export function isAnimatedImageUrl(url: string): boolean {
  return GIF_EXT_RE.test(url);
}

export function getStaticArtworkSrc(url: string): string {
  const { pathname, suffix } = splitUrlSuffix(url);
  const managedGifMatch = MANAGED_GIF_UPLOAD_RE.exec(pathname);
  if (!managedGifMatch) return url;

  return `/uploads/${managedGifMatch[1]}.poster.webp${suffix}`;
}
