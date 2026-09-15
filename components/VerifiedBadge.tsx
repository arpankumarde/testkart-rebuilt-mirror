import * as React from "react";
import { BadgeCheck } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "./Tooltip";
import styles from "./VerifiedBadge.module.css";

interface VerifiedBadgeProps {
  isVerified: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({
  isVerified,
  size = "sm",
  className,
}) => {
  // Per instance, not a shared constant. Every badge renders its own <defs>,
  // so a fixed id put duplicates in the document and each one resolved to the
  // first match - which paints nothing when that first badge happens to sit in
  // a display:none subtree, as it does for the expert page's breakpoint swap.
  const gradientId = `verified-gradient-${React.useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  if (!isVerified) return null;

  return (
    <div
      className={`${styles.badgeWrapper} ${styles[size]} ${className || ""}`}
    >
      {/* Hidden SVG for defining the custom gradient fill */}
      <svg width="0" height="0" className={styles.svgDefs}>
        <defs>
          <linearGradient
            id={gradientId}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop stopColor="hsl(20 100% 75%)" offset="0%" />
            <stop stopColor="hsl(20 100% 55%)" offset="100%" />
          </linearGradient>
        </defs>
      </svg>

      <Tooltip>
        <TooltipTrigger asChild>
          <div className={styles.iconContainer}>
            <BadgeCheck
              className={styles.icon}
              size="100%"
              fill={`url(#${gradientId})`}
              color="white"
              strokeWidth={1.5}
            />
          </div>
        </TooltipTrigger>
        <TooltipContent sideOffset={4}>Verified Teacher</TooltipContent>
      </Tooltip>
    </div>
  );
};