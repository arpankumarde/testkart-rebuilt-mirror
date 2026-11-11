import React from "react";
import { PLAY_BADGE_IMAGE, PLAY_STORE_URL } from "../helpers/appLandingContent";
import styles from "./PlayStoreBadge.module.css";

interface PlayStoreBadgeProps {
  /** Sets the badge height through --badge-h; everything else follows it. */
  className?: string;
}

/**
 * The "Get it on Google Play" badge from cdn.testkart.in, linked to the
 * Testkart listing. The PNG has no padding, so it fills a 3.375 x --badge-h
 * box, the same box AppStoreBadgeSoon uses.
 */
export const PlayStoreBadge = ({ className }: PlayStoreBadgeProps) => (
  <a
    href={PLAY_STORE_URL}
    target="_blank"
    rel="noopener noreferrer"
    className={`${styles.link} ${className ?? ""}`.trim()}
  >
    <img
      src={PLAY_BADGE_IMAGE}
      alt="Get it on Google Play"
      width={270}
      height={81}
      className={styles.image}
      decoding="async"
    />
  </a>
);
