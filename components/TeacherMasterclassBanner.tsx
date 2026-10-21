import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, X, ArrowRight } from "lucide-react";
import { useMasterclassesListQuery } from "../helpers/useMasterclasses";
import styles from "./TeacherMasterclassBanner.module.css";

// Namespaced by masterclass id, not a single flag: dismissing this week's
// webinar should not hide next month's. localStorage (not a DB column) is
// intentional - this is a per-browser "don't show me this one again", not
// account state, and it costs nothing to read on every dashboard load.
const DISMISS_KEY_PREFIX = "tk-teacher-masterclass-dismissed:";

const formatWhen = (startTime: Date | string): string => {
  const date = new Date(startTime);
  const datePart = new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  }).format(date);
  const timePart = new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(date);
  return `${datePart} · ${timePart} IST`;
};

interface TeacherMasterclassBannerProps {
  className?: string;
}

/**
 * Attention-grabbing sticky strip promoting the next upcoming masterclass,
 * shown across the teacher dashboard until that specific event is dismissed.
 * Pulls from the same public /masterclasses/list endpoint the marketing page
 * uses (already sorted upcoming-first), so a newly published event shows up
 * here with no extra wiring.
 */
export const TeacherMasterclassBanner: React.FC<TeacherMasterclassBannerProps> = ({ className }) => {
  const { data } = useMasterclassesListQuery();
  const upcoming = data?.masterclasses.find((m) => !m.isPast);

  const [dismissedId, setDismissedId] = useState<number | null>(null);

  // Re-read on every upcoming event change so a brand-new masterclass
  // (different id, no stored dismissal yet) reappears even if the teacher
  // closed a previous one.
  useEffect(() => {
    if (!upcoming) return;
    try {
      const stored = window.localStorage.getItem(`${DISMISS_KEY_PREFIX}${upcoming.id}`);
      setDismissedId(stored ? upcoming.id : null);
    } catch {
      // Storage unavailable (private browsing, etc.) - just show the banner.
    }
  }, [upcoming?.id]);

  if (!upcoming || dismissedId === upcoming.id) {
    return null;
  }

  const handleDismiss = () => {
    try {
      window.localStorage.setItem(`${DISMISS_KEY_PREFIX}${upcoming.id}`, "1");
    } catch {
      // Ignore - worst case it shows again next load.
    }
    setDismissedId(upcoming.id);
  };

  return (
    <div className={`${styles.banner} ${className ?? ""}`.trim()} role="region" aria-label="Upcoming masterclass">
      <Link to={`/masterclass/${upcoming.slug}`} className={styles.link}>
        <span className={styles.badge}>
          <span className={styles.badgeDot} aria-hidden="true" />
          Free masterclass
        </span>
        <Sparkles size={15} className={styles.sparkle} aria-hidden="true" />
        <span className={styles.text}>
          <span className={styles.title}>{upcoming.title}</span>
          <span className={styles.when}>{formatWhen(upcoming.startTime)}</span>
        </span>
        <span className={styles.cta}>
          <span>Register free</span>
          <ArrowRight size={14} aria-hidden="true" />
        </span>
      </Link>
      <button
        type="button"
        className={styles.close}
        onClick={handleDismiss}
        aria-label="Dismiss masterclass announcement"
      >
        <X size={16} />
      </button>
    </div>
  );
};
