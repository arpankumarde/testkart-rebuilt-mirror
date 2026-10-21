import React, { useState } from "react";
import { Check, Copy, Globe, Link2 } from "lucide-react";
import { Button } from "./Button";
import { ConsoleConfirmDialog } from "./ConsoleConfirmDialog";
import { ContentVisibilityPicker } from "./ContentVisibilityPicker";
import { Skeleton } from "./Skeleton";
import { useAdminContentEdit } from "../helpers/useAdminContentEdit";
import { useContentVisibilityStatus } from "../helpers/useContentVisibilityStatus";
import { useUpdateContentVisibility } from "../helpers/useUpdateContentVisibility";
import { usePublishesWithoutReview } from "../helpers/usePublishesWithoutReview";
import { CONTENT_NOUNS } from "../helpers/contentReviewStatus";
import { UNLISTED_HINT } from "../helpers/contentVisibility";
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
 * it off every listing and going public needs review. Visibility is the
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
  let note: string;
  if (status.live && unlisted && status.inReview) {
    note = `Live as unlisted. Your request to make it public is waiting for review; it stays unlisted until it is approved.`;
  } else if (status.live && unlisted) {
    note = `Live as unlisted. ${UNLISTED_HINT} It stays out of search, listings, your profile and search engines.`;
  } else if (status.live) {
    note = "Live and public. Students can find it in search, listings and your profile.";
  } else if (unlisted) {
    note = "Draft. Publishing puts it live at once, without review, for anyone with the link.";
  } else {
    note = skipsReview
      ? "Draft. Publishing puts it live and lists it publicly."
      : "Draft. Publishing sends it for review; it is listed once approved.";
  }

  return (
    <section className={`${styles.panel} ${className ?? ""}`} aria-label={`Visibility of this ${noun}`}>
      <ContentVisibilityPicker
        value={status.visibility}
        onChange={choose}
        disabled={update.isPending}
        footnote={note}
      />

      {status.live && unlisted && status.inReview && (
        <div>
          <Button type="button" variant="outline" size="sm" disabled={update.isPending} onClick={() => save("unlisted")}>
            Cancel the public request
          </Button>
        </div>
      )}

      {status.publicRequestRejection && (
        <p className={styles.rejection} role="status">
          <strong>Not approved for public listing.</strong>{" "}
          {status.publicRequestRejection.reason ?? "No reason was given."} It stays live as unlisted.
        </p>
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
        title={confirming === "unlisted" ? `Make this ${noun} unlisted?` : `Make this ${noun} public?`}
        description={
          confirming === "unlisted"
            ? skipsReview
              ? "It leaves search, listings, your profile and the sitemap at once. Its link keeps working for everyone who has it."
              : "It leaves search, listings, your profile and the sitemap at once. Its link keeps working. Making it public again later goes through review."
            : skipsReview
              ? "It is listed in search, categories and your profile right away."
              : "It goes to our team for review first. Until it is approved it stays live as unlisted, and we email you the decision."
        }
        confirmLabel={confirming === "unlisted" ? "Make unlisted" : skipsReview ? "Make public" : "Submit for review"}
        pendingLabel="Saving..."
        isPending={update.isPending}
        onConfirm={() => confirming && save(confirming)}
      />
    </section>
  );
};