import { useEffect } from "react";
import { HTML_FRAME_CLASS } from "./htmlFrame";

const MIN_HEIGHT = 80;
const MAX_HEIGHT = 20000;
const SCALE_TOLERANCE = 0.02;

// Site tokens sent into a frame, as --tk-<name> there.
const THEME_TOKENS: Record<string, string> = {
  background: "--background",
  foreground: "--foreground",
  surface: "--surface",
  muted: "--muted",
  "muted-foreground": "--muted-foreground",
  border: "--border",
  brand: "--tk-brand",
  "brand-ink": "--tk-brand-ink",
  "brand-text": "--tk-brand-text",
};

const readThemeTokens = (): Record<string, string> => {
  const styles = getComputedStyle(document.body);
  return Object.fromEntries(
    Object.entries(THEME_TOKENS).map(([name, token]) => [name, styles.getPropertyValue(token).trim()])
  );
};

/**
 * Connects the interactive content frames inside `container` to the page: sizes
 * each one to the height it reports, and keeps it on the site's theme. Heights
 * come from code the frame runs, so only a number from one of these frames is
 * read, and it is clamped. `theme` pins a mode for a surface that doesn't follow
 * the site, like the white print sheet.
 */
export function useHtmlFrame(container: HTMLElement | null, html: string, theme?: "light") {
  useEffect(() => {
    if (!container || !html.includes(HTML_FRAME_CLASS)) return;
    const frames = () => Array.from(container.querySelectorAll<HTMLIFrameElement>(`iframe.${HTML_FRAME_CLASS}`));

    const onMessage = (event: MessageEvent) => {
      const { tkHtmlFrame: height, tkHtmlFrameWidth: width } = (event.data ?? {}) as {
        tkHtmlFrame?: unknown;
        tkHtmlFrameWidth?: unknown;
      };
      if (typeof height !== "number" || !Number.isFinite(height)) return;
      const frame = frames().find((candidate) => candidate.contentWindow === event.source);
      if (!frame) return;
      // A frame's pixels can differ from the page's under zoom or display scaling.
      // Width gives the ratio because setting a height can't make it out of date,
      // and rounding alone must not shift the height.
      const ratio = typeof width === "number" && width > 0 ? frame.clientWidth / width : 1;
      const scale = Number.isFinite(ratio) && ratio > 0 && Math.abs(ratio - 1) > SCALE_TOLERANCE ? ratio : 1;
      frame.style.height = `${Math.min(Math.max(Math.ceil(height * scale), MIN_HEIGHT), MAX_HEIGHT)}px`;
    };

    const syncFrames = () => {
      const mode = theme ?? (document.body.classList.contains("dark") ? "dark" : "light");
      const tokens = theme ? {} : readThemeTokens();
      for (const frame of frames()) {
        // A frame stays transparent only while its colour scheme matches its element's.
        frame.style.colorScheme = mode;
        frame.contentWindow?.postMessage({ tkHtmlFrameSync: { mode, tokens } }, "*");
      }
    };

    window.addEventListener("message", onMessage);
    // Load doesn't bubble, so this listens in the capture phase. A frame can report
    // before it has a layout, and one that loaded before this effect, as after
    // SSR, has already reported; syncing covers both.
    container.addEventListener("load", syncFrames, true);
    const themeObserver = new MutationObserver(syncFrames);
    themeObserver.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    syncFrames();
    return () => {
      window.removeEventListener("message", onMessage);
      container.removeEventListener("load", syncFrames, true);
      themeObserver.disconnect();
    };
  }, [container, html, theme]);
}