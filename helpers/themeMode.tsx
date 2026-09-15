export type ThemeMode = "light" | "dark" | "auto";

const STORAGE_KEY = "testkart_theme_mode";

function saveThemeMode(mode: ThemeMode): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Storage blocked: the mode still applies for this visit.
  }
}

/**
 * Switch to dark mode by adding the "dark" class to document.body, and remember it.
 */
export function switchToDarkMode(): void {
  // Clear any auto mode listener if present.
  if (currentMediaQuery) {
    currentMediaQuery.onchange = null;
    currentMediaQuery = null;
  }
  document.body.classList.add("dark");
  saveThemeMode("dark");
}

/**
 * Switch to light mode by removing the "dark" class from document.body, and remember it.
 */
export function switchToLightMode(): void {
  // Clear any auto mode listener if present.
  if (currentMediaQuery) {
    currentMediaQuery.onchange = null;
    currentMediaQuery = null;
  }
  document.body.classList.remove("dark");
  saveThemeMode("light");
}

/**
 * Re-applies the mode saved by the last switch. Runs once at app load. Does nothing on the
 * server or when nothing was saved, which keeps the default light theme.
 */
export function restoreThemeMode(): void {
  if (typeof window === "undefined" || typeof document === "undefined" || !document.body) {
    return;
  }
  let saved: string | null;
  try {
    saved = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return;
  }
  if (saved === "dark") switchToDarkMode();
  else if (saved === "light") switchToLightMode();
  else if (saved === "auto") switchToAutoMode();
}

function updateTheme(darkPreferred: boolean): void {
  if (darkPreferred) {
    document.body.classList.add("dark");
  } else {
    document.body.classList.remove("dark");
  }
}

let currentMediaQuery: MediaQueryList | null = null;

/**
 * Switch to auto mode, and remember it. This function immediately applies the user's color scheme
 * preference and listens for system preference changes to update the theme automatically.
 * It uses the onchange property instead of addEventListener to avoid TypeScript issues.
 */
export function switchToAutoMode(): void {
  if (currentMediaQuery) {
    currentMediaQuery.onchange = null;
  }
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  mediaQuery.onchange = (e: MediaQueryListEvent) => {
    updateTheme(e.matches);
  };
  currentMediaQuery = mediaQuery;
  updateTheme(mediaQuery.matches);
  saveThemeMode("auto");
}

/**
 * Returns the current theme mode:
 * - "auto" if auto mode is enabled,
 * - "dark" if the document body has the "dark" class,
 * - "light" otherwise.
 */
export function getCurrentThemeMode(): ThemeMode {
  if (currentMediaQuery) {
    return "auto";
  }
  return document.body.classList.contains("dark") ? "dark" : "light";
}