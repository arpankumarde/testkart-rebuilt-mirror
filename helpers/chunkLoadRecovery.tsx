/**
 * Recovery for a page script that cannot be fetched. Every page is its own hashed file under
 * /_assets/, and a tab that still holds an older index.html (or a CDN edge that cached a miss
 * during a publish) asks for a file that is not there. The browser reports it as "Failed to fetch
 * dynamically imported module" and the page stays blank. index.html is served no-cache, so one
 * reload fetches the current entry and the files it names.
 */

const RELOAD_KEY = "tk_chunk_reload_at";
const RELOAD_COOLDOWN_MS = 60 * 1000;

const CHUNK_ERROR_PATTERNS = [
  /Failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /Importing a module script failed/i,
  /Unable to preload CSS/i,
  /ChunkLoadError/i,
];

function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const message =
    typeof error === "string" ? error : error instanceof Error ? `${error.name} ${error.message}` : "";
  return CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

/**
 * Reloads the page once per cooldown window and returns whether it did. The cooldown stops a
 * file that is genuinely missing from putting the visitor in a reload loop; the error screen
 * takes over from there.
 */
function reloadOnce(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const last = Number(window.sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last < RELOAD_COOLDOWN_MS) return false;
    window.sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

let installed = false;

/** Catches failures that happen outside React rendering, such as a preload started by a link hover. */
function install() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("vite:preloadError", (event) => {
    if (reloadOnce()) event.preventDefault();
  });

  window.addEventListener("unhandledrejection", (event) => {
    if (isChunkLoadError(event.reason)) reloadOnce();
  });
}

export const chunkLoadRecovery = { install, isChunkLoadError, reloadOnce };
