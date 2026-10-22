import React from "react";
import { Link2 } from "lucide-react";
import { Badge } from "./Badge";
import { contentPublicationStatus, PUBLICATION_STATUS_META, UNLISTED_HINT, UNLISTED_LABEL } from "../helpers/contentVisibility";
import styles from "./UnlistedBadge.module.css";

interface UnlistedBadgeProps {
  live: boolean;
  inReview: boolean;
  rejected: boolean;
  className?: string;
}

/* Marks an unlisted item in teacher lists and cards, with where its request to go public stands. */
export const UnlistedBadge: React.FC<UnlistedBadgeProps> = ({ live, inReview, rejected, className }) => {
  const status = contentPublicationStatus({ live, visibility: "unlisted", inReview, rejected });
  const request = status === "public_pending" || status === "public_rejected" ? PUBLICATION_STATUS_META[status] : null;

  return (
    <span className={`${styles.group} ${className ?? ""}`}>
      <Badge variant="lavender" className={styles.badge} title={UNLISTED_HINT}>
        <Link2 size={13} aria-hidden="true" />
        {UNLISTED_LABEL}
      </Badge>
      {request && (
        <Badge
          variant={request.variant}
          title={status === "public_pending" ? "Request to make it public is with our team" : "Request to make it public was rejected"}
        >
          {request.label}
        </Badge>
      )}
    </span>
  );
};