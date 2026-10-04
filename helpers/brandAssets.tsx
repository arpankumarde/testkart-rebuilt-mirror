// Central source of truth for Testkart's branding image URLs.
// These are hosted on our own domain via Cloudflare R2 (see helpers/r2Client.tsx),
// not on Floot's asset storage. Update these constants if a brand image is ever
// changed, and every place referencing the brand will pick it up. Give a changed
// image a new file name so social apps drop their cached preview.

export const BRAND_LOGO_LIGHT = "https://cdn.testkart.in/branding/logo-light.png";
export const BRAND_LOGO_DARK = "https://cdn.testkart.in/branding/logo-dark.png";
export const BRAND_FAVICON = "https://cdn.testkart.in/branding/favicon.png";
/** Default share image (og:image / twitter:image): the homepage hero, captured 11-10-2026. */
export const BRAND_OG_IMAGE = "https://cdn.testkart.in/branding/og-image-v2.png";
export const BRAND_APP_ICON = "https://cdn.testkart.in/branding/app-icon.png";

/** Picks the correct logo variant for the current color scheme. */
export const getBrandLogo = (isDarkMode: boolean): string =>
  isDarkMode ? BRAND_LOGO_DARK : BRAND_LOGO_LIGHT;
