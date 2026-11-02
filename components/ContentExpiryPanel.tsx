import React, { useState } from "react";
import { CalendarX, RotateCcw } from "lucide-react";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { ConsoleConfirmDialog } from "./ConsoleConfirmDialog";
import { ExpiryDateField } from "./ExpiryDateField";
import { Skeleton } from "./Skeleton";
import { useAdminContentEdit } from "../helpers/useAdminContentEdit";
import { useContentExpiryStatus, useRelistContent, useUpdateContentExpiry } from "../helpers/useContentExpiry";
import { CONTENT_NOUNS } from "../helpers/contentReviewStatus";
import {
  EXPIRY_HELP,
  formatExpiryDay,
  formatExpiryMoment,
  LISTING_STATUS_META,
} from "../helpers/contentExpiry";
import type { InputType } from "../endpoints/teacher/content-expiry/update_POST.schema";
import styles from "./ContentExpiryPanel.module.css";

interface ContentExpiryPanelProps {
  contentType: InputType["contentType"];
  /** The item's own id; for a live test this is liveTests.id. */
  contentId: number | null | undefined;
  /** "card" stands alone with its own border; "inline" sits inside a host card that supplies the padding. */
  variant?: "card" | "inline";
  className?: string;
}

/*
 * Optional expiry date for a saved teacher item, placed beside its visibility
 * panel in every editor. Saves on pick. Once expired the item is unlisted
 * automatically and only Relist puts it back on sale; a new date alone does
 * not. Admins manage expiry from the admin panel, so it hides in admin edit.
 */
export const ContentExpiryPanel: React.FC<ContentExpiryPanelProps> = (props) =>
  useAdminContentEdit() ? null : <ContentExpiryPanelBody {...props} />;

const ContentExpiryPanelBody: React.FC<ContentExpiryPanelProps> = ({
  contentType,
  contentId,
  variant = "card",
  className,
}) => {
  const { data: status, isFetching } = useContentExpiryStatus(contentType, contentId);
  const update = useUpdateContentExpiry();
  const relist = useRelistContent();
  const [confirmingRelist, setConfirmingRelist] = useState(false);
  const noun = CONTENT_NOUNS[contentType];
  const rootClass = `${styles.panel} ${variant === "card" ? styles.card : ""} ${className ?? ""}`;

  if (!status) {
    return isFetching ? (
      <div className={rootClass}>
        <Skeleton className={styles.skeleton} />
      </div>
    ) : null;
  }

  const save = (expiryDay: string | null) => {
    if (typeof contentId !== "number" || expiryDay === status.expiryDay) return;
    update.mutate({ contentType, contentId, expiryDay });
  };

  const statusMeta = LISTING_STATUS_META[status.status];
  const showStatus = status.expiryDay !== null || status.expired;
  const busy = update.isPending || relist.isPending;

  return (
    <section className={rootClass} aria-label={`Expiry date of this ${noun}`}>
      <div className={styles.head}>
        <span className={styles.legend}>Expiry date</span>
        <span className={styles.optional}>Optional</span>
        {showStatus && (
          <Badge variant={statusMeta.variant} title={statusMeta.hint}>
            {statusMeta.label}
          </Badge>
        )}
      </div>

      <ExpiryDateField value={status.expiryDay} onChange={save} disabled={busy} />

      <p className={styles.help}>
        {EXPIRY_HELP}
        {status.expiryDay && !status.expired
          ? ` On sale until the end of ${formatExpiryDay(status.expiryDay)} (IST).`
          : ""}
      </p>

      {status.expired && (
        <div className={styles.callout} role="status">
          <CalendarX size={18} aria-hidden="true" className={styles.calloutIcon} />
          <div className={styles.calloutBody}>
            <p className={styles.calloutTitle}>Expired and unlisted</p>
            <p className={styles.calloutText}>
              {status.expiredAt
                ? `Unlisted automatically on ${formatExpiryMoment(new Date(status.expiredAt))}.`
                : "Its expiry date has passed, so it is no longer on sale."}{" "}
              Students who bought it keep their access.
            </p>
            <p className={styles.calloutText}>
              {status.canRelist
                ? `Relist it to put it back on sale as ${status.relistVisibility === "public" ? "public" : "unlisted"}.`
                : "To relist it, pick a new expiry date or remove it, then relist."}
            </p>
            <Button
              type="button"
              size="sm"
              disabled={!status.canRelist || busy}
              onClick={() => setConfirmingRelist(true)}
            >
              <RotateCcw size={14} aria-hidden="true" />
              Relist
            </Button>
          </div>
        </div>
      )}

      <ConsoleConfirmDialog
        open={confirmingRelist}
        onOpenChange={(open) => {
          if (!open && !relist.isPending) setConfirmingRelist(false);
        }}
        icon={<RotateCcw size={20} />}
        title={`Relist this ${noun}?`}
        description={
          status.relistVisibility === "public"
            ? `It goes back on sale and is listed in search, categories and your profile again${status.expiryDay ? `, until the end of ${formatExpiryDay(status.expiryDay)}` : ""}.`
            : `It goes back on sale as unlisted, open to anyone with its link${status.expiryDay ? `, until the end of ${formatExpiryDay(status.expiryDay)}` : ""}.`
        }
        confirmLabel="Relist"
        pendingLabel="Relisting..."
        isPending={relist.isPending}
        onConfirm={() => {
          if (typeof contentId !== "number") return;
          relist.mutate({ contentType, contentId }, { onSettled: () => setConfirmingRelist(false) });
        }}
      />
    </section>
  );
};