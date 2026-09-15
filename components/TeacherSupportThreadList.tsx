import React from "react";
import { Badge } from "./Badge";
import { Skeleton } from "./Skeleton";
import { MessageSquare } from "lucide-react";
import { SupportThreadWithUnread } from "../endpoints/teacher/support/threads_GET.schema";
import { formatRelativeTime } from "../helpers/formatTime";
import styles from "./TeacherSupportThreadList.module.css";

interface Props {
  threads: SupportThreadWithUnread[];
  isFetching: boolean;
  selectedThreadId: number | null;
  onSelectThread: (id: number) => void;
  /* Replaces the "no conversations yet" copy when the list is filtered. */
  emptyTitle?: string;
  emptyText?: string;
  className?: string;
}

export const TeacherSupportThreadList: React.FC<Props> = ({
  threads,
  isFetching,
  selectedThreadId,
  onSelectThread,
  emptyTitle = "No conversations yet",
  emptyText = "Start one and the Testkart team will reply here.",
  className,
}) => {
  if (isFetching && threads.length === 0) {
    return (
      <div className={`${styles.container} ${className || ""}`}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className={styles.skeletonCard}>
            <Skeleton className={styles.skeletonTitle} />
            <Skeleton className={styles.skeletonMeta} />
          </div>
        ))}
      </div>
    );
  }

  if (threads.length === 0) {
    return (
      <div className={`${styles.emptyState} ${className || ""}`}>
        <span className={styles.emptyIcon} aria-hidden="true">
          <MessageSquare size={26} />
        </span>
        <h3 className={styles.emptyTitle}>{emptyTitle}</h3>
        <p>{emptyText}</p>
      </div>
    );
  }

  return (
    <div className={`${styles.container} ${className || ""}`}>
      {threads.map((thread) => {
        const isSelected = thread.id === selectedThreadId;
        return (
          <button
            key={thread.id}
            type="button"
            className={`${styles.threadCard} ${isSelected ? styles.selected : ""}`}
            onClick={() => onSelectThread(thread.id)}
          >
            <div className={styles.cardHeader}>
              <h3 className={styles.subject}>{thread.subject}</h3>
              {thread.unreadCount > 0 && (
                <span className={styles.unreadBadge}>{thread.unreadCount}</span>
              )}
            </div>
            <div className={styles.cardMeta}>
              <Badge
                variant={
                  thread.status === "open"
                    ? "default"
                    : thread.status === "resolved"
                    ? "success"
                    : "secondary"
                }
              >
                {thread.status}
              </Badge>
              <span className={styles.time}>
                {formatRelativeTime(thread.lastMessageAt)}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
};