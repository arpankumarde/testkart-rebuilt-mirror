/**
 * Language video blocks: one video per language, shown to readers as language tabs with Hindi
 * first. The editor stores the list on the block (components/RichTextEditor.tsx) and serializes
 * tabs and panels as plain markup, so installLanguageVideoTabs() below is all a page needs to
 * make them switch - wherever editor content is rendered.
 */

export type LanguageVideoKind = "file" | "youtube";

export interface LanguageVideo {
  language: string;
  kind: LanguageVideoKind;
  src: string;
}

export const DEFAULT_VIDEO_LANGUAGE = "Hindi";

export const VIDEO_LANGUAGE_OPTIONS = [
  "Hindi",
  "English",
  "Bengali",
  "Marathi",
  "Telugu",
  "Tamil",
  "Gujarati",
  "Kannada",
  "Malayalam",
  "Odia",
  "Punjabi",
  "Assamese",
];

export const MAX_VIDEO_LANGUAGE_LENGTH = 30;

export const YOUTUBE_EMBED_ALLOW =
  "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";

const YOUTUBE_HOST = /(^|\.)(youtube\.com|youtube-nocookie\.com)$/i;
const YOUTUBE_ID = /^[A-Za-z0-9_-]{6,20}$/;
const YOUTUBE_EMBED_SRC = /^https:\/\/www\.youtube(-nocookie)?\.com\/embed\/[A-Za-z0-9_-]{6,20}$/;

/** Pasted text that is only a YouTube link. Global, as editor paste rules require. */
export const YOUTUBE_LINK_TEXT = /^((?:https?:)?\/\/)?((?:www|m|music)\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com)\/\S+$/g;

function youtubeEmbedUrl(url: URL): string | null {
  const host = url.hostname.toLowerCase();
  let id: string | null = null;
  if (host === "youtu.be") {
    id = url.pathname.split("/")[1] ?? null;
  } else if (url.pathname === "/watch") {
    id = url.searchParams.get("v");
  } else {
    id = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/]+)/)?.[1] ?? null;
  }
  return id && id !== "videoseries" && YOUTUBE_ID.test(id) ? `https://www.youtube.com/embed/${id}` : null;
}

export type VideoLinkResult =
  | { ok: true; kind: LanguageVideoKind; src: string }
  | { ok: false; message: string };

/** A YouTube watch, share, Shorts or embed link becomes an embed; any other https link is played as a video file. */
export function parseVideoLink(input: string): VideoLinkResult {
  const trimmed = input.trim();
  const withScheme = trimmed.startsWith("//")
    ? `https:${trimmed}`
    : /^[\w-]+(\.[\w-]+)+(\/|$)/.test(trimmed)
      ? `https://${trimmed}`
      : trimmed;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return { ok: false, message: "That is not a valid link. Paste the full address, starting with https://" };
  }
  const isYoutube = url.hostname.toLowerCase() === "youtu.be" || YOUTUBE_HOST.test(url.hostname);
  // YouTube links are rebuilt as https embeds, so an old http share link is fine.
  if (isYoutube && (url.protocol === "https:" || url.protocol === "http:")) {
    const src = youtubeEmbedUrl(url);
    return src
      ? { ok: true, kind: "youtube", src }
      : { ok: false, message: "Could not find a video in that YouTube link. Copy the link from the video's Share button." };
  }
  if (url.protocol !== "https:") {
    return { ok: false, message: "The video link must start with https://" };
  }
  return { ok: true, kind: "file", src: url.href };
}

function isPlayableSrc(kind: LanguageVideoKind, src: string): boolean {
  if (kind === "youtube") return YOUTUBE_EMBED_SRC.test(src);
  try {
    return new URL(src).protocol === "https:";
  } catch {
    return false;
  }
}

/** Drops blank or repeated languages and any src that is not a playable https link. */
export function normalizeLanguageVideos(raw: unknown): LanguageVideo[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const videos: LanguageVideo[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;
    const language =
      typeof entry.language === "string" ? entry.language.trim().slice(0, MAX_VIDEO_LANGUAGE_LENGTH) : "";
    if (!language || seen.has(language.toLowerCase())) continue;
    seen.add(language.toLowerCase());
    const kind: LanguageVideoKind = entry.kind === "youtube" ? "youtube" : "file";
    const src = typeof entry.src === "string" && isPlayableSrc(kind, entry.src) ? entry.src : "";
    videos.push({ language, kind, src });
  }
  return videos;
}

export function encodeLanguageVideos(videos: LanguageVideo[]): string {
  return encodeURIComponent(JSON.stringify(videos));
}

export function decodeLanguageVideos(value: string | null): LanguageVideo[] {
  if (!value) return [];
  try {
    return normalizeLanguageVideos(JSON.parse(decodeURIComponent(value)));
  } catch {
    return [];
  }
}

/** Stable per content, so saving the same block twice produces the same HTML. */
export function languageVideoBlockId(videos: LanguageVideo[]): string {
  const text = encodeLanguageVideos(videos);
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) >>> 0;
  }
  return `language-video-${hash.toString(36)}`;
}

const TAB_SELECTOR = "[data-language-video-tab]";

function stopPlayback(panel: HTMLElement) {
  panel.querySelectorAll("video").forEach((video) => video.pause());
  // Hidden YouTube players keep playing; reloading the frame is the only stop without the player API.
  panel.querySelectorAll("iframe").forEach((frame) => {
    const src = frame.getAttribute("src");
    if (src) frame.setAttribute("src", src);
  });
}

function selectTab(tab: HTMLElement) {
  const block = tab.closest<HTMLElement>("[data-language-video]");
  const index = tab.dataset.languageVideoTab;
  if (!block || index === undefined) return;
  block.querySelectorAll<HTMLElement>(TAB_SELECTOR).forEach((other) => {
    other.setAttribute("aria-selected", String(other === tab));
  });
  block.querySelectorAll<HTMLElement>("[data-language-video-panel]").forEach((panel) => {
    const isActive = panel.dataset.languageVideoPanel === index;
    if (isActive) {
      panel.querySelectorAll("video").forEach((video) => {
        if (video.preload === "none") video.preload = "metadata";
      });
    } else if (panel.dataset.active === "true") {
      stopPlayback(panel);
    }
    panel.dataset.active = String(isActive);
  });
}

function tabFromEvent(event: Event): HTMLElement | null {
  return event.target instanceof Element ? event.target.closest<HTMLElement>(TAB_SELECTOR) : null;
}

function handleTabClick(event: MouseEvent) {
  const tab = tabFromEvent(event);
  if (tab && tab.getAttribute("aria-selected") !== "true") selectTab(tab);
}

function handleTabKeyDown(event: KeyboardEvent) {
  const tab = tabFromEvent(event);
  if (!tab?.parentElement) return;
  const tabs = Array.from(tab.parentElement.querySelectorAll<HTMLElement>(TAB_SELECTOR));
  const current = tabs.indexOf(tab);
  const targets: Record<string, number> = {
    ArrowRight: current + 1,
    ArrowLeft: current - 1,
    Home: 0,
    End: tabs.length - 1,
  };
  const next = targets[event.key];
  if (next === undefined || tabs.length < 2) return;
  event.preventDefault();
  const target = tabs[(next + tabs.length) % tabs.length];
  target.focus();
  selectTab(target);
}

let tabsInstalled = false;

/** One document-level listener covers every block on every page, including content rendered later. */
export function installLanguageVideoTabs() {
  if (tabsInstalled || typeof document === "undefined") return;
  tabsInstalled = true;
  document.addEventListener("click", handleTabClick);
  document.addEventListener("keydown", handleTabKeyDown);
}