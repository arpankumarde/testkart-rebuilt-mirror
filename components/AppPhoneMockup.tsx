import React from "react";
import type { AppScreen } from "../helpers/appLandingContent";
import styles from "./AppPhoneMockup.module.css";

interface AppPhoneMockupProps {
  screen: AppScreen;
  /** Above-the-fold phone: load eagerly at high priority instead of lazily. */
  priority?: boolean;
  /** Sets the size and placement. The width comes from --phone-w on this class. */
  className?: string;
}

/**
 * An Android handset with one of the app's Play Store screenshots filling its
 * 9:18 screen, whole and uncropped. Every measurement is in em off a
 * font-size derived from --phone-w, so the frame scales as one piece.
 */
export const AppPhoneMockup = ({ screen, priority = false, className }: AppPhoneMockupProps) => (
  <div className={`${styles.phone} ${className ?? ""}`.trim()}>
    <div className={styles.screen}>
      <img
        src={screen.src}
        alt={screen.alt}
        width={screen.width}
        height={screen.height}
        className={styles.shot}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        {...(priority ? { fetchpriority: "high" } : {})}
      />
    </div>
  </div>
);
