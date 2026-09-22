import { useLocation } from "react-router-dom";
import { Wrench } from "lucide-react";
import styles from "./SiteNoticeStrip.module.css";

const NOTICE_MESSAGE = "Testkart will be undergoing maintenance today at 11 PM IST";

// Midnight IST after the maintenance, so a stale "today" never shows.
const NOTICE_ENDS_AT = Date.parse("2026-09-25T00:00:00+05:30");

// Full-screen test and course players, which size themselves to the viewport.
const HIDDEN_PATH_PREFIXES = ["/portal/", "/live-portal/", "/student/courses/"];

// Each half of the track has to be wider than the screen for the loop to be seamless.
const COPIES_PER_HALF = 6;

export const SiteNoticeStrip = () => {
  const { pathname } = useLocation();

  if (Date.now() >= NOTICE_ENDS_AT) {
    return null;
  }

  if (HIDDEN_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return null;
  }

  return (
    <div className={styles.strip} data-site-notice="" role="region" aria-label="Site notice">
      <span className={styles.chip}>
        <Wrench className={styles.chipIcon} aria-hidden="true" />
        <span className={styles.chipLabel}>Notice</span>
      </span>
      <div className={styles.viewport}>
        <p className={styles.message}>{NOTICE_MESSAGE}</p>
        <div className={styles.track} aria-hidden="true">
          {Array.from({ length: COPIES_PER_HALF * 2 }, (_, index) => (
            <span key={index} className={styles.item}>
              {NOTICE_MESSAGE}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};