import React, { useMemo, useState } from "react";
import { Check, Copy, Mail, ExternalLink } from "lucide-react";
import { FaWhatsapp, FaFacebookF, FaXTwitter, FaTelegram, FaLinkedinIn } from "react-icons/fa6";
import type { IconType } from "react-icons";
import { toast } from "sonner";
import { Button } from "./Button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./Dialog";
import {
  buildPublicAssetUrl,
  buildShareIntentUrl,
  buildTrackedShareUrl,
  SHARE_ASSET_LABELS,
  type ShareAssetKind,
  type SharePlatformId,
} from "../helpers/shareLinks";
import { trackShare } from "../helpers/trackStorefrontEvent";
import styles from "./ShareAssetDialog.module.css";

interface ShareAssetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: ShareAssetKind;
  /** Slug, except for live tests (id) and certificates (certificate number). */
  handle: string | number;
  title: string;
  /**
   * utm_campaign for every link this dialog builds. Required, not defaulted:
   * see the campaign constants in helpers/shareLinks for why each surface
   * reports into its own bucket.
   */
  campaign: string;
  /**
   * Whose voice the default message is written in. A teacher sharing from their
   * console, or a student sharing their own certificate, is the owner; anyone
   * sharing from a public page is a visitor and "my course" would be wrong.
   */
  sharer?: "owner" | "visitor";
  /** Overrides "Share this {label}". */
  heading?: string;
  /** Overrides the default message entirely. */
  message?: string;
}

type Platform = {
  id: Exclude<SharePlatformId, "copy">;
  label: string;
  Icon: IconType | React.ComponentType<{ size?: number }>;
  className: string;
};

/** Kinds whose label is a plural noun, so the demonstrative has to agree with
    it - "these study notes", not "this study notes". */
const PLURAL_LABEL_KINDS = new Set<ShareAssetKind>(["study-note"]);

const PLATFORMS: Platform[] = [
  { id: "whatsapp", label: "WhatsApp", Icon: FaWhatsapp, className: "whatsapp" },
  { id: "facebook", label: "Facebook", Icon: FaFacebookF, className: "facebook" },
  { id: "x", label: "X", Icon: FaXTwitter, className: "x" },
  { id: "telegram", label: "Telegram", Icon: FaTelegram, className: "telegram" },
  { id: "linkedin", label: "LinkedIn", Icon: FaLinkedinIn, className: "linkedin" },
  { id: "email", label: "Email", Icon: Mail, className: "email" },
];

export const ShareAssetDialog: React.FC<ShareAssetDialogProps> = ({
  open,
  onOpenChange,
  kind,
  handle,
  title,
  campaign,
  sharer = "visitor",
  heading,
  message,
}) => {
  const [copied, setCopied] = useState(false);

  const publicUrl = useMemo(() => buildPublicAssetUrl(kind, handle), [kind, handle]);
  const copyUrl = useMemo(
    () => buildTrackedShareUrl(publicUrl, "copy", campaign),
    [publicUrl, campaign]
  );

  const label = SHARE_ASSET_LABELS[kind];
  const demonstrative = PLURAL_LABEL_KINDS.has(kind) ? "these" : "this";
  const determiner = sharer === "owner" ? "my" : demonstrative;
  const shareMessage = message ?? `Check out ${determiner} ${label} on Testkart: ${title}`;
  const subject = `${title} on Testkart`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(copyUrl);
      trackShare(kind, handle, "copy", campaign);
      setCopied(true);
      toast.success("Link copied. It already carries your tracking tags.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy automatically. Select the link and copy it.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* aria-describedby is cleared explicitly: there is no DialogDescription,
          and Radix warns about a missing one otherwise. */}
      <DialogContent className={styles.content} aria-describedby={undefined}>
        <DialogHeader className={styles.header}>
          <DialogTitle>{heading ?? `Share ${demonstrative} ${label}`}</DialogTitle>
        </DialogHeader>

        <p className={styles.assetTitle} title={title}>
          {title}
        </p>

        <ul className={styles.platforms}>
          {PLATFORMS.map(({ id, label: platformLabel, Icon, className }) => {
            const trackedUrl = buildTrackedShareUrl(publicUrl, id, campaign);
            const href = buildShareIntentUrl(id, trackedUrl, shareMessage, subject);
            const isMail = id === "email";
            return (
              <li key={id}>
                <a
                  className={styles.platform}
                  href={href}
                  target={isMail ? undefined : "_blank"}
                  rel={isMail ? undefined : "noopener noreferrer"}
                  onClick={() => trackShare(kind, handle, id, campaign)}
                >
                  <span className={`${styles.platformIcon} ${styles[className]}`} aria-hidden="true">
                    <Icon size={18} />
                  </span>
                  <span className={styles.platformLabel}>{platformLabel}</span>
                </a>
              </li>
            );
          })}
        </ul>

        <div className={styles.copyBlock}>
          <label className={styles.copyLabel} htmlFor="share-asset-link">
            Or copy the link
          </label>
          <div className={styles.copyRow}>
            <input
              id="share-asset-link"
              className={styles.copyInput}
              value={copyUrl}
              readOnly
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button onClick={handleCopy} className={styles.copyButton}>
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? "Copied" : "Copy link"}
            </Button>
          </div>
        </div>

        <a
          className={styles.previewLink}
          href={publicUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          <ExternalLink size={14} />
          Open the public page
        </a>
      </DialogContent>
    </Dialog>
  );
};
