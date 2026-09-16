import React, { useRef } from "react";
import { AlertCircle, FileText, Loader2, Paperclip, X } from "lucide-react";
import { Button } from "./Button";
import {
  attachmentTypeLabel,
  formatAttachmentSize,
  isImageAttachment,
  SUPPORT_ATTACHMENT_ACCEPT,
  type SupportAttachment,
} from "../helpers/supportAttachmentRules";
import type { PendingSupportAttachment } from "../helpers/useSupportAttachmentUploads";
import styles from "./SupportAttachments.module.css";

/** Files already sent with a message. Images show as thumbnails, other files as cards; both open in a new tab. */
export function SupportAttachmentList({
  attachments,
  align = "start",
}: {
  attachments: SupportAttachment[];
  align?: "start" | "end";
}) {
  if (attachments.length === 0) return null;
  return (
    <ul className={`${styles.list} ${align === "end" ? styles.alignEnd : ""}`} aria-label="Attachments">
      {attachments.map((attachment) => (
        <li key={attachment.key} className={styles.listItem}>
          {isImageAttachment(attachment.contentType) ? (
            <a
              href={attachment.url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.imageLink}
              title={`${attachment.fileName} (${formatAttachmentSize(attachment.sizeBytes)})`}
            >
              <img src={attachment.url} alt={attachment.fileName} loading="lazy" className={styles.image} />
            </a>
          ) : (
            <a
              href={attachment.url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.fileCard}
              title={attachment.fileName}
            >
              <span className={styles.fileIcon} aria-hidden="true">
                <FileText size={18} />
              </span>
              <span className={styles.fileText}>
                <span className={styles.fileName}>{attachment.fileName}</span>
                <span className={styles.fileMeta}>
                  {attachmentTypeLabel(attachment.fileName)}, {formatAttachmentSize(attachment.sizeBytes)}
                </span>
              </span>
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Opens the file picker. Pass label for a text button; without it the button is icon-only. */
export function SupportAttachButton({
  onFiles,
  disabled,
  label,
}: {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={SUPPORT_ATTACHMENT_ACCEPT}
        className={styles.hiddenInput}
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (files.length > 0) onFiles(files);
        }}
      />
      {label ? (
        <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={disabled}>
          <Paperclip size={16} />
          {label}
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          aria-label="Attach files"
          title="Attach files, up to 4 MB each"
        >
          <Paperclip size={16} />
        </Button>
      )}
    </>
  );
}

/** Files picked for the message being written, with upload progress and a remove button. */
export function SupportPendingAttachments({
  items,
  onRemove,
}: {
  items: PendingSupportAttachment[];
  onRemove: (id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <ul className={styles.pendingList} aria-label="Files to send">
      {items.map((item) => (
        <li key={item.id} className={`${styles.chip} ${item.status === "failed" ? styles.chipFailed : ""}`}>
          <span className={styles.chipIcon} aria-hidden="true">
            {item.status === "uploading" ? (
              <Loader2 size={16} className={styles.spin} />
            ) : item.status === "failed" ? (
              <AlertCircle size={16} />
            ) : (
              <Paperclip size={16} />
            )}
          </span>
          <span className={styles.chipText}>
            <span className={styles.chipName} title={item.fileName}>
              {item.fileName}
            </span>
            <span className={styles.chipMeta} role={item.status === "failed" ? "alert" : undefined}>
              {item.status === "uploading"
                ? "Uploading..."
                : item.status === "failed"
                  ? item.error
                  : formatAttachmentSize(item.sizeBytes)}
            </span>
          </span>
          <button
            type="button"
            className={styles.chipRemove}
            onClick={() => onRemove(item.id)}
            aria-label={`Remove ${item.fileName}`}
          >
            <X size={16} />
          </button>
        </li>
      ))}
    </ul>
  );
}