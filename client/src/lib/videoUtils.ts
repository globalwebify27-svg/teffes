/**
 * Video utility helpers for detecting and formatting video sources.
 */

/**
 * Checks whether the given URL is a YouTube video URL.
 * Supports standard watch URLs, short youtu.be links, shorts, embeds, and nocookie domains.
 */
export function isYouTubeUrl(url: string | undefined | null): boolean {
  if (!url || typeof url !== "string") return false;
  const clean = url.trim().toLowerCase();
  return (
    clean.includes("youtube.com") ||
    clean.includes("youtu.be") ||
    clean.includes("youtube-nocookie.com")
  );
}

/**
 * Extracts YouTube video ID from supported URL patterns.
 */
export function getYouTubeVideoId(url: string | undefined | null): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();

  // Pattern matches:
  // - youtube.com/watch?v=ID
  // - youtube.com/embed/ID
  // - youtube.com/v/ID
  // - youtube.com/shorts/ID
  // - youtu.be/ID
  const regExp = /(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?|shorts)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = trimmed.match(regExp);
  return match ? match[1] : null;
}

/**
 * Generates an embedded YouTube URL with modest branding and privacy-enhanced domain.
 */
export function getYouTubeEmbedUrl(url: string | undefined | null, autoPlay = false): string | null {
  const id = getYouTubeVideoId(url);
  if (!id) return null;
  const autoPlayParam = autoPlay ? "&autoplay=1" : "";
  return `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&enablejsapi=1${autoPlayParam}`;
}

/**
 * Generates a YouTube high-quality thumbnail image URL for thumbnail strips and previews.
 */
export function getYouTubeThumbnailUrl(url: string | undefined | null): string | null {
  const id = getYouTubeVideoId(url);
  if (!id) return null;
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
}

/**
 * Checks whether a URL is a valid web URL format.
 */
export function isValidUrl(url: string | undefined | null): boolean {
  if (!url || typeof url !== "string") return false;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
