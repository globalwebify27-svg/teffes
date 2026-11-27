export const META_PIXEL_ID = "799210613093978";

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
    _fbq?: any;
  }
}

export const trackEvent = (event: string, options: Record<string, any> = {}) => {
  if (typeof window !== "undefined") {
    if (typeof window.fbq === "function") {
      try {
        window.fbq("track", event, options);
        console.log(`[Meta Pixel] Tracked "${event}":`, options);
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
