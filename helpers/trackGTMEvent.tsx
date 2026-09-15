declare global {
  interface Window {
    dataLayer: Array<Record<string, unknown>>;
  }
}

/**
 * Pushes an event to Google Tag Manager's dataLayer safely.
 * Initializes the dataLayer if it doesn't exist.
 *
 * @param eventData - An object containing the event name and any additional properties.
 */
export const trackGTMEvent = (eventData: {
  event: string;
  [key: string]: unknown;
}) => {
  if (typeof window !== "undefined") {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(eventData);
  }
};