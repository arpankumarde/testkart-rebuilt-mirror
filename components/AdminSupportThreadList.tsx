import React, { useEffect, useRef } from "react";
import { AlertCircle, ChevronLeft, ChevronRight, MessageSquare } from "lucide-react";
import type { AdminSupportThread } from "../endpoints/admin/support/threads_GET.schema";
import {
  supportListTime,
  supportStatusBadge,
  supportStatusLabel,
  supportTimestamp,
} from "../helpers/adminSupportFormat";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";
import styles from "./AdminSupportThreadList.module.css";

interface Props {
  threads: AdminSupportThread[];
  hasData: boolean;
  isError: boolean;
  errorMessage?: string;
  onRetry: () => void;
  isFiltered: boolean;
  onClearFilters: () => void;
  /* Status badges only help on the All tab; the other tabs already name the status. */
  showStatus: boolean;
  selectedId: number | null;
  onSelect: (id: number) => void;
  now: number;
  page: number;
  totalPages: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  /* The rows on screen belong to the previous page or filter while the next one loads. */
  isStale: boolean;
}

const RowSkeleton = () => (
  <div className={styles.skeletonRow}>
    <div className={styles.itemTop}>
      <Skeleton style={{ height: "0.875rem", width: "45%" }} />
      <Skeleton style={{ height: "0.75rem", width: "3rem" }} />
    </div>
    <Skeleton style={{ height: "0.875rem", width: "80%" }} />
    <Skeleton style={{ height: "0.75rem", width: "95%" }} />
  </div>
);

/* The inbox's left pane: one row per thread, newest activity first, with a pager under it. */
export const AdminSupportThreadList: React.FC<Props> = ({
  threads,
  hasData,
  isError,
  errorMessage,
  onRetry,
  isFiltered,
  onClearFilters,
  showStatus,
  selectedId,
  onSelect,
  now,
  page,
  totalPages,
  totalCount,
  onPageChange,
  isStale,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [page]);

  if (!hasData && isError) {
    return (
      <div className={styles.state} role="alert">
        <span className={`${styles.stateIcon} ${styles.stateIconError}`} aria-hidden="true">
          <AlertCircle size={22} />
        </span>
        <h2 className={styles.stateTitle}>Could not load the support threads</h2>
        <p className={styles.stateText}>{errorMessage || "The request did not come back. Check your connection and try again."}</p>
        <Button variant="outline" onClick={onRetry}>Try again</Button>
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className={styles.scroll} aria-busy="true">
        {Array.from({ length: 7 }).map((_, index) => <RowSkeleton key={index} />)}
      </div>
    );
  }

  return (
    <>
      {isError && (
        <div className={styles.refreshError} role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          <span className={styles.refreshErrorText}>Could not refresh. This is the last list that loaded.</span>
          <button type="button" className={styles.refreshErrorAction} onClick={onRetry}>Try again</button>
        </div>
      )}

      {threads.length === 0 ? (
        <div className={styles.state}>
          <span className={styles.stateIcon} aria-hidden="true">
            <MessageSquare size={22} />
          </span>
          <h2 className={styles.stateTitle}>{isFiltered ? "No threads match" : "The inbox is clear"}</h2>
          <p className={styles.stateText}>
            {isFiltered
              ? "Nothing here for these filters. Widen them to see the rest."
              : "Messages from teachers land here. Nothing is waiting on you."}
          </p>
          {isFiltered && <Button variant="outline" onClick={onClearFilters}>Show all threads</Button>}
        </div>
      ) : (
        <div ref={scrollRef} className={`${styles.scroll} ${isStale ? styles.stale : ""}`} aria-busy={isStale}>
          <ul className={styles.list}>
            {threads.map((thread) => {
              const isSelected = thread.id === selectedId;
              const isUnread = thread.unreadCount > 0;
              const needsReply = thread.status === "open" && thread.lastSenderType === "teacher";
              return (
                <li key={thread.id}>
                  <button
                    type="button"
                    className={`${styles.item} ${isSelected ? styles.itemSelected : ""} ${isUnread ? styles.itemUnread : ""}`}
                    onClick={() => onSelect(thread.id)}
                    aria-current={isSelected ? "true" : undefined}
                  >
                    <span className={styles.itemTop}>
                      <span className={styles.teacher} title={thread.teacherName}>{thread.teacherName}</span>
                      <span className={styles.itemEnd}>
                        {isUnread && (
                          <span className={styles.unreadCount}>
                            {thread.unreadCount}
                            <span className={styles.srOnly}> unread</span>
                          </span>
                        )}
                        <time
                          className={styles.time}
                          dateTime={new Date(thread.lastMessageAt).toISOString()}
                          title={supportTimestamp(thread.lastMessageAt)}
                        >
                          {supportListTime(thread.lastMessageAt, now)}
                        </time>
                      </span>
                    </span>
                    <span className={styles.itemTop}>
                      <span className={styles.subject} title={thread.subject}>{thread.subject}</span>
                      {needsReply ? (
                        <span className={styles.needsReply}>Needs reply</span>
                      ) : (
                        showStatus && (
                          <Badge variant={supportStatusBadge(thread.status)} className={styles.status}>
                            {supportStatusLabel(thread.status)}
                          </Badge>
                        )
                      )}
                    </span>
                    <span className={styles.preview}>
                      {thread.lastSenderType === "admin" && <span className={styles.previewFrom}>Team: </span>}
                      {thread.lastMessagePreview || "No messages yet"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <footer className={styles.footer}>
        <span className={styles.total}>
          {totalCount.toLocaleString("en-IN")} {totalCount === 1 ? "thread" : "threads"}
        </span>
        {totalPages > 1 && (
          <nav className={styles.pager} aria-label="Thread pages">
            <Button
              variant="ghost"
              size="icon-md"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              aria-label="Previous page"
            >
              <ChevronLeft />
            </Button>
            <span className={styles.pagerText}>
              {page} of {totalPages}
            </span>
            <Button
              variant="ghost"
              size="icon-md"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              aria-label="Next page"
            >
              <ChevronRight />
            </Button>
          </nav>
        )}
      </footer>
    </>
  );
};