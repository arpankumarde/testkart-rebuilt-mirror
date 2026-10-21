import React from "react";
import { Link2 } from "lucide-react";
import { Badge } from "./Badge";
import { UNLISTED_HINT, UNLISTED_LABEL } from "../helpers/contentVisibility";
import styles from "./UnlistedBadge.module.css";

/* Marks an unlisted item in teacher lists and cards. */
export const UnlistedBadge: React.FC<{ className?: string }> = ({ className }) => (
  <Badge variant="lavender" className={`${styles.badge} ${className ?? ""}`} title={UNLISTED_HINT}>
    <Link2 size={13} aria-hidden="true" />
    {UNLISTED_LABEL}
  </Badge>
);