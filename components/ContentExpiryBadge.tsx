import React from "react";
import { CalendarClock, CalendarX } from "lucide-react";
import { Badge } from "./Badge";
import {
  expiryLastDay,
  formatExpiryDay,
  isExpired,
  isExpiringSoon,
  LISTING_STATUS_META,
} from "../helpers/contentExpiry";
import styles from "./ContentExpiryBadge.module.css";

interface ContentExpiryBadgeProps {
  expiresAt: Date | null | undefined;
  expiredAt: Date | null | undefined;
  className?: string;
}

/*
 * Expiry marker for teacher and admin lists: Expired once the date has passed,
 * Expiring soon in its last week, otherwise a quiet "Expires <date>". Nothing
 * when the item has no expiry.
 */
export const ContentExpiryBadge: React.FC<ContentExpiryBadgeProps> = ({ expiresAt, expiredAt, className }) => {
  const fields = { expiresAt: expiresAt ?? null, expiredAt: expiredAt ?? null };
  if (!fields.expiresAt && !fields.expiredAt) return null;
  const day = fields.expiresAt ? formatExpiryDay(expiryLastDay(fields.expiresAt)) : null;
  const badgeClass = `${styles.badge} ${className ?? ""}`;

  if (isExpired(fields)) {
    const meta = LISTING_STATUS_META.expired;
    return (
      <Badge variant={meta.variant} className={badgeClass} title={meta.hint}>
        <CalendarX size={13} aria-hidden="true" />
        {meta.label}
      </Badge>
    );
  }
  if (isExpiringSoon(fields)) {
    const meta = LISTING_STATUS_META.expiring_soon;
    return (
      <Badge variant={meta.variant} className={badgeClass} title={`On sale until the end of ${day} (IST).`}>
        <CalendarClock size={13} aria-hidden="true" />
        {meta.label}
        {day ? ` - ${day}` : ""}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className={badgeClass} title={`On sale until the end of ${day} (IST), then unlisted automatically.`}>
      <CalendarClock size={13} aria-hidden="true" />
      Expires {day}
    </Badge>
  );
};