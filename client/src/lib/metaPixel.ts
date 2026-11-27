export const META_PIXEL_ID = "799210613093978";

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
    _fbq?: any;
  }
}

export const trackEvent = (event: string, options: Record<string, any> = {}) => {
  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    try {
      window.fbq("track", event, options);
    } catch (e) {
      console.warn("[MetaPixel] Failed to track event:", event, e);
    }
  }
};

export const trackCustomEvent = (event: string, options: Record<string, any> = {}) => {
  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    try {
      window.fbq("trackCustom", event, options);
    } catch (e) {
      console.warn("[MetaPixel] Failed to track custom event:", event, e);
    }
  }
};
