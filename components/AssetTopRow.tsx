import React, { useState } from "react";
import { Share2 } from "lucide-react";
import { ShareAssetDialog } from "./ShareAssetDialog";
import { PUBLIC_PAGE_SHARE_CAMPAIGN, type ShareAssetKind } from "../helpers/shareLinks";
import styles from "./AssetTopRow.module.css";

interface AssetTopRowProps {
  /** The page's breadcrumb, or its h1 on a page without one. */
  children: React.ReactNode;
  /** Which kind of element leads the row, so the button centres on its first line. */
  leading?: "breadcrumb" | "title";
  kind: ShareAssetKind;
  /** Slug, except for live tests (id). */
  handle: string | number;
  title: string;
  /** Hide the Share button at phone widths (the course page opts in). */
  hideShareOnMobile?: boolean;
  className?: string;
}

/**
 * Top row of the public asset detail pages: the breadcrumb with the page's
 * primary Share button at the top right, styled like the expert profile's.
 * Shown to every visitor whatever their role or enrollment.
 */
export const AssetTopRow: React.FC<AssetTopRowProps> = ({
  children,
  leading = "breadcrumb",
  kind,
  handle,
  title,
  hideShareOnMobile = false,
  className,
}) => {
  const [isShareOpen, setShareOpen] = useState(false);

  return (
    <div className={`${styles.row} ${leading === "title" ? styles.titleLed : ""} ${className || ""}`}>
      {children}
      <button
        type="button"
        className={`${styles.share} ${hideShareOnMobile ? styles.hideOnMobile : ""}`}
        onClick={() => setShareOpen(true)}
      >
        <Share2 size={16} aria-hidden="true" />
        Share
      </button>

      <ShareAssetDialog
        open={isShareOpen}
        onOpenChange={setShareOpen}
        kind={kind}
        handle={handle}
        title={title}
        campaign={PUBLIC_PAGE_SHARE_CAMPAIGN}
      />
    </div>
  );
};