// Central source of truth for Testkart's branding image URLs.
// These are hosted on our own domain via Cloudflare R2 (see helpers/r2Client.tsx),
// not on Floot's asset storage. Update these constants if a brand image is ever
// changed, and every place referencing the brand will pick it up. Give a changed
// image a new file name so social apps drop their cached preview.
// Everything lives under cdn.testkart.in/brand/, the same logo URLs the mobile app
// uses. Do not point anything at the old branding folder.

export const BRAND_LOGO_LIGHT = "https://cdn.testkart.in/brand/logo-light.png";
export const BRAND_LOGO_DARK = "https://cdn.testkart.in/brand/logo-dark.png";
/** Round brand mark for in-app UI. The page's favicon links come from helpers/BrandFavicons. */
export const BRAND_FAVICON = "https://cdn.testkart.in/brand/tk-favicon.png";
/** Default share image (og:image / twitter:image): the homepage hero, captured 11-10-2026. */
export const BRAND_OG_IMAGE = "https://cdn.testkart.in/brand/tk-og-image.png";
export const BRAND_APP_ICON = "https://cdn.testkart.in/brand/tk-app-icon.png";

/** Picks the correct logo variant for the current color scheme. */
export const getBrandLogo = (isDarkMode: boolean): string =>
  isDarkMode ? BRAND_LOGO_DARK : BRAND_LOGO_LIGHT;
