import React, { useState } from "react";
import { Check, Clock, Copy, Globe, Link2, XCircle } from "lucide-react";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { ConsoleConfirmDialog } from "./ConsoleConfirmDialog";
import { ContentVisibilityPicker } from "./ContentVisibilityPicker";
import { Skeleton } from "./Skeleton";
import { useAdminContentEdit } from "../helpers/useAdminContentEdit";
import { useContentVisibilityStatus } from "../helpers/useContentVisibilityStatus";
import { useUpdateContentVisibility } from "../helpers/useUpdateContentVisibility";
import { usePublishesWithoutReview } from "../helpers/usePublishesWithoutReview";
import { CONTENT_NOUNS } from "../helpers/contentReviewStatus";
import { PUBLICATION_STATUS_META, UNLISTED_HINT } from "../helpers/contentVisibility";
import type { ContentVisibility } from "../helpers/schema";
import type { InputType } from "../endpoints/teacher/content-visibility/update_POST.schema";
import styles from "./ContentVisibilityPanel.module.css";

interface ContentVisibilityPanelProps {
  contentType: InputType["contentType"];
  /** The item's own id; for a live test this is liveTests.id. */
  contentId: number | null | undefined;
  className?: string;
}

/*
 * Public / unlisted control for a saved teacher item, shown in its editor.
 * A draft switches at once. A live item asks first, since going unlisted takes
 * it off every listing and going public needs review. While a request to go
 * public waits, Public is locked and the panel says where the request stands;
 * a rejected request shows the reason and can be sent again. Visibility is the
 * teacher's call, so it is not shown while an admin edits their item.
 */
export const ContentVisibilityPanel: React.FC<ContentVisibilityPanelProps> = (props) =>
  useAdminContentEdit() ? null : <ContentVisibilityPanelBody {...props} />;

const ContentVisibilityPanelBody: React.FC<ContentVisibilityPanelProps> = ({ contentType, contentId, className }) => {
  const { data: status, isFetching } = useContentVisibilityStatus(contentType, contentId);
  const update = useUpdateContentVisibility();
  const skipsReview = usePublishesWithoutReview();
  const [confirming, setConfirming] = useState<ContentVisibility | null>(null);
  const [copied, setCopied] = useState(false);
  const noun = CONTENT_NOUNS[contentType];
  // Bundles skip review, so they switch at once for every teacher.
  const switchesAtOnce = skipsReview || contentType === "course_bundle";

  if (!status) {
    return isFetching ? <Skeleton className={`${styles.skeleton} ${className ?? ""}`} /> : null;
  }

  const save = (visibility: ContentVisibility) => {
    if (typeof contentId !== "number") return;
    update.mutate({ contentType, contentId, visibility }, { onSettled: () => setConfirming(null) });
  };

  const choose = (visibility: ContentVisibility) => {
    if (visibility === status.visibility) return;
    if (status.live) setConfirming(visibility);
    else save(visibility);
  };

  const shareUrl = status.publicPath && typeof window !== "undefined" ? `${window.location.origin}${status.publicPath}` : null;
  const copyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const unlisted = status.visibility === "unlisted";
  const isPending = status.publicationStatus === "public_pending";
  const isRejected = status.publicationStatus === "public_rejected";
  const statusMeta = PUBLICATION_STATUS_META[status.publicationStatus];
  let note: string;
  if (status.live && unlisted) {
    note = `Live as unlisted. ${UNLISTED_HINT} It stays out of search, listings, your profile and search engines.`;
  } else if (status.live) {
    note = "Live and public. Students can find it in search, listings and your profile.";
  } else if (status.inReview) {
    note = "Pending review. It goes live and is listed once our team approves it.";
  } else if (unlisted) {
    note = "Draft. Publishing puts it live at once, without review, for anyone with the link.";
  } else {
    note = switchesAtOnce
      ? "Draft. Publishing puts it live and lists it publicly."
      : "Draft. Publishing sends it for review; it is listed once approved.";
  }

  return (
    <section className={`${styles.panel} ${className ?? ""}`} aria-label={`Visibility of this ${noun}`}>
      <ContentVisibilityPicker
        value={status.visibility}
        onChange={choose}
        disabled={update.isPending}
        footnote={isPending || isRejected ? null : note}
        status={<Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>}
        locked={isPending ? { value: "public", tag: "Pending review" } : undefined}
      />

      {isPending && (
        <div className={`${styles.callout} ${styles.calloutPending}`} role="status">
          <Clock size={18} aria-hidden="true" className={styles.calloutIcon} />
          <div className={styles.calloutBody}>
            <p className={styles.calloutTitle}>Your request is pending review</p>
            <p className={styles.calloutText}>
              It stays Unlisted, and its link keeps working, until our team approves it. We will email you when the
              review is complete.
            </p>
            <Button type="button" variant="outline" size="sm" disabled={update.isPending} onClick={() => save("unlisted")}>
              Cancel request
            </Button>
          </div>
        </div>
      )}

      {isRejected && (
        <div className={`${styles.callout} ${styles.calloutRejected}`} role="status">
          <XCircle size={18} aria-hidden="true" className={styles.calloutIcon} />
          <div className={styles.calloutBody}>
            <p className={styles.calloutTitle}>Your request to make this public was rejected</p>
            {status.publicRequestRejection?.reason && (
              <p className={styles.calloutText}>
                <strong>Reason:</strong> {status.publicRequestRejection.reason}
              </p>
            )}
            <p className={styles.calloutText}>
              It stays Unlisted, and its link keeps working. Make any changes needed, then send it again.
            </p>
            <Button type="button" size="sm" disabled={update.isPending} onClick={() => setConfirming("public")}>
              Resubmit for review
            </Button>
          </div>
        </div>
      )}

      {status.live && shareUrl && (
        <div className={styles.share}>
          <span className={styles.shareUrl} title={shareUrl}>
            {shareUrl}
          </span>
          <Button type="button" variant="outline" size="sm" onClick={copyLink}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? "Copied" : "Copy link"}
          </Button>
        </div>
      )}

      <ConsoleConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open && !update.isPending) setConfirming(null);
        }}
        icon={confirming === "unlisted" ? <Link2 size={20} /> : <Globe size={20} />}
        title={
          confirming === "unlisted"
            ? `Make this ${noun} unlisted?`
            : isRejected
              ? `Resubmit this ${noun} for review?`
              : `Make this ${noun} public?`
        }
        description={
          confirming === "unlisted"
            ? switchesAtOnce
              ? "It leaves search, listings, your profile and the sitemap at once. Its link keeps working for everyone who has it."
              : "It leaves search, listings, your profile and the sitemap at once. Its link keeps working. Making it public again later goes through review."
            : switchesAtOnce
              ? "It is listed in search, categories and your profile right away."
              : "It goes to our team for review first. Until it is approved it stays live as unlisted, and we email you the decision."
        }
        confirmLabel={
          confirming === "unlisted"
            ? "Make unlisted"
            : switchesAtOnce
              ? "Make public"
              : isRejected
                ? "Resubmit for review"
                : "Submit for review"
        }
        pendingLabel="Saving..."
        isPending={update.isPending}
        onConfirm={() => confirming && save(confirming)}
      />
    </section>
  );
};