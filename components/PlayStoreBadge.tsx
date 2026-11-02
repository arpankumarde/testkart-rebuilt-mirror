import React from "react";
import { PLAY_BADGE_IMAGE, PLAY_STORE_URL } from "../helpers/appLandingContent";
import styles from "./PlayStoreBadge.module.css";

interface PlayStoreBadgeProps {
  /** Sets the badge height through --badge-h; everything else follows it. */
  className?: string;
}

/**
 * Google's own "Get it on Google Play" artwork, linked to the Testkart
 * listing. The PNG ships with transparent padding round the badge, so it is
 * cropped to the black rounded rectangle the same way the student dashboard
 * crops it, just scaled off --badge-h.
 */
export const PlayStoreBadge = ({ className }: PlayStoreBadgeProps) => (
  <a
    href={PLAY_STORE_URL}
    target="_blank"
    rel="noopener noreferrer"
    className={`${styles.link} ${className ?? ""}`.trim()}
  >
    <span className={styles.crop}>
      <img
        src={PLAY_BADGE_IMAGE}
        alt="Get it on Google Play"
        width={646}
        height={250}
        className={styles.image}
        decoding="async"
      />
    </span>
  </a>
);
