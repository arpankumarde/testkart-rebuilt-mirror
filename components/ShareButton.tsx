import React, { useState } from "react";
import { Share2 } from "lucide-react";
import { Button } from "./Button";
import { ShareAssetDialog } from "./ShareAssetDialog";
import type { ShareAssetKind } from "../helpers/shareLinks";

type ButtonProps = React.ComponentProps<typeof Button>;

interface ShareButtonProps {
  kind: ShareAssetKind;
  /** Slug, except for live tests (id) and certificates (certificate number). */
  handle: string | number;
  title: string;
  /** utm_campaign - see the campaign constants in helpers/shareLinks. */
  campaign: string;
  sharer?: "owner" | "visitor";
  /** Dialog title. Defaults to "Share this {label of the kind}". */
  heading?: string;
  /** Overrides the dialog's default share message. */
  message?: string;
  /** Button text. The icon is always shown. */
  label?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
}

/**
 * A share trigger that owns its dialog. Surfaces that already hold other
 * dialog state (the teacher cards, the asset sidebars) mount ShareAssetDialog
 * directly instead; this is for the pages where the button is a leaf.
 */
export const ShareButton: React.FC<ShareButtonProps> = ({
  kind,
  handle,
  title,
  campaign,
  sharer,
  heading,
  message,
  label = "Share",
  variant = "outline",
  size,
  className,
}) => {
  const [isShareOpen, setShareOpen] = useState(false);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={() => setShareOpen(true)}
      >
        <Share2 size={18} />
        {label}
      </Button>

      <ShareAssetDialog
        open={isShareOpen}
        onOpenChange={setShareOpen}
        kind={kind}
        handle={handle}
        title={title}
        campaign={campaign}
        sharer={sharer}
        heading={heading}
        message={message}
      />
    </>
  );
};
