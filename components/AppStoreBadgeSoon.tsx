import React from "react";
import styles from "./AppStoreBadgeSoon.module.css";

interface AppStoreBadgeSoonProps {
  /** Sets the badge height through --badge-h, the same variable PlayStoreBadge uses. */
  className?: string;
}

/**
 * A placeholder App Store badge for the iOS app that does not exist yet. It
 * matches PlayStoreBadge's box (3.375 x --badge-h) so the two sit as a pair,
 * but it is not a link: no href, no hover, no pointer. A small "Coming soon"
 * tag on its top edge says why.
 */
export const AppStoreBadgeSoon = ({ className }: AppStoreBadgeSoonProps) => (
  <span
    className={`${styles.badge} ${className ?? ""}`.trim()}
    role="img"
    aria-label="App Store: iOS app coming soon"
    title="iOS app coming soon"
  >
    <svg viewBox="0 0 24 24" className={styles.logo} aria-hidden="true" focusable="false">
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09ZM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
    <span className={styles.text} aria-hidden="true">
      <span className={styles.small}>Download on the</span>
      <span className={styles.large}>App Store</span>
    </span>
    <span className={styles.soon} aria-hidden="true">
      Coming soon
    </span>
  </span>
);
