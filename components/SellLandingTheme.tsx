import styles from "./SellLandingTheme.module.css";

/*
 * The /sell design tokens (--sl-*) for the /sell sub-pages, so their sections
 * and the shared SellLanding* components read the same palette as /sell.
 * pages/sell.module.css still carries its own copy of these values; keep the
 * two in step until /sell is pointed at this class.
 */
export const sellLandingThemeClass = styles.theme;
