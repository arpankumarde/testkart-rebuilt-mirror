import React from "react";
import { ContentExpiryBadge } from "./ContentExpiryBadge";
import { UnlistedBadge } from "./UnlistedBadge";
import { isExpired } from "../helpers/contentExpiry";
import type { ContentVisibility } from "../helpers/schema";
import styles from "./TeacherListingBadges.module.css";

interface TeacherListingBadgesProps {
  visibility: ContentVisibility;
  live: boolean;
  inReview: boolean;
  rejected: boolean;
  expiresAt?: Date | null;
  expiredAt?: Date | null;
  className?: string;
}

/*
 * Listing markers under a teacher item's title: Unlisted when the teacher chose
 * it, and the expiry badge. An expired item is unlisted by the system, so it
 * shows Expired alone rather than Unlisted.
 */
export const TeacherListingBadges: React.FC<TeacherListingBadgesProps> = ({
  visibility,
  live,
  inReview,
  rejected,
  expiresAt,
  expiredAt,
  className,
}) => {
  const expired = isExpired({ expiresAt: expiresAt ?? null, expiredAt: expiredAt ?? null });
  const showUnlisted = visibility === "unlisted" && !expired;
  const showExpiry = !!expiresAt || !!expiredAt;
  if (!showUnlisted && !showExpiry) return null;

  return (
    <span className={`${styles.group} ${className ?? ""}`}>
      {showUnlisted && <UnlistedBadge live={live} inReview={inReview} rejected={rejected} />}
      <ContentExpiryBadge expiresAt={expiresAt} expiredAt={expiredAt} />
    </span>
  );
};