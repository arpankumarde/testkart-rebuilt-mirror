import * as React from "react";
import { BadgeCheck } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "./Tooltip";
import styles from "./VerifiedBadge.module.css";

export type VerifiedBadgeSize = "xs" | "sm" | "md" | "lg";

interface VerifiedBadgeProps {
  isVerified: boolean;
  size?: VerifiedBadgeSize;
  /** Fill colour of the badge; the check mark stays white. Defaults to the brand coral. */
  color?: string;
  label?: string;
  className?: string;
}

/*
 * The one verified mark on Testkart. Every place that shows a verified teacher
 * renders this, so the icon, stroke and proportions never drift between pages -
 * only the size and fill colour vary, through props.
 */
export const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({
  isVerified,
  size = "sm",
  color,
  label = "Verified Teacher",
  className,
}) => {
  if (!isVerified) return null;

  const style = color
    ? ({ "--verified-badge-color": color } as React.CSSProperties)
    : undefined;

  return (
    <span
      className={`${styles.badgeWrapper} ${styles[size]} ${className || ""}`}
      style={style}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={styles.iconContainer} role="img" aria-label={label}>
            <BadgeCheck
              className={styles.icon}
              size="100%"
              strokeWidth={1.5}
              aria-hidden="true"
            />
          </span>
        </TooltipTrigger>
        <TooltipContent sideOffset={4}>{label}</TooltipContent>
      </Tooltip>
    </span>
  );
};