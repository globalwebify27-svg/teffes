export const META_PIXEL_ID = "799210613093978";

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
    _fbq?: any;
  }
}

/**
 * Strips the 'prod-' prefix from a product ID to match the Meta Commerce Catalog ID.
 * Example: 'prod-33095920' -> '33095920'
 */
export const formatMetaCatalogId = (id?: string | number): string => {
  if (!id) return "";
  return String(id).trim().replace(/^prod-/, "");
};

export const trackEvent = (event: string, options: Record<string, any> = {}) => {
  if (typeof window !== "undefined") {
    const sanitizedOptions = { ...options };
    if (Array.isArray(sanitizedOptions.content_ids)) {
      sanitizedOptions.content_ids = sanitizedOptions.content_ids
        .map((id: any) => formatMetaCatalogId(id))
        .filter(Boolean);
    }
    if (typeof window.fbq === "function") {
      try {
        window.fbq("track", event, sanitizedOptions);
        console.log(`[Meta Pixel] Tracked "${event}":`, sanitizedOptions);
      } catch (e) {
        console.warn("[Meta Pixel] Failed to track event:", event, e);
      }
    } else {
      console.warn("[Meta Pixel] fbq not initialized yet for event:", event);
    }
  }
};

export const trackCustomEvent = (event: string, options: Record<string, any> = {}) => {
  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    try {
      window.fbq("trackCustom", event, options);
      console.log(`[Meta Pixel] Custom Tracked "${event}":`, options);
    } catch (e) {
      console.warn("[Meta Pixel] Failed to track custom event:", event, e);
    }
  }
};
