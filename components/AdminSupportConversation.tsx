import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  Archive,
  ArrowDown,
  ArrowLeft,
  CheckCircle,
  ExternalLink,
  Loader2,
  RefreshCw,
  RotateCcw,
  Send,
} from "lucide-react";
import type { AdminSupportThread } from "../endpoints/admin/support/threads_GET.schema";
import type { OutputType as ThreadMessages } from "../endpoints/admin/support/thread/messages_GET.schema";
import { postAdminSupportAttachmentUpload } from "../endpoints/admin/support/attachments/upload_POST.schema";
import type { SupportThreadStatus } from "../helpers/schema";
import {
  useAdminReplyMutation,
  useAdminThreadMessagesQuery,
  useRefreshAdminSupport,
  useUpdateThreadStatusMutation,
} from "../helpers/useAdminSupport";
import { useAdminAuth } from "../helpers/useAdminAuth";
import { useSupportAttachmentUploads } from "../helpers/useSupportAttachmentUploads";
import { linkifyText } from "../helpers/linkifyText";
import {
  supportDate,
  supportDayKey,
  supportDayLabel,
  supportStatusBadge,
  supportStatusLabel,
  supportTime,
  supportTimestamp,
} from "../helpers/adminSupportFormat";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";
import { Textarea } from "./Textarea";
import { SupportAttachButton, SupportAttachmentList, SupportPendingAttachments } from "./SupportAttachments";
import styles from "./AdminSupportConversation.module.css";

type ThreadMessage = ThreadMessages[number];

interface Props {
  thread: AdminSupportThread;
  onBack: () => void;
  /* The unsent reply, kept by the page so switching threads does not lose it. */
  draft: string;
  onDraftChange: (text: string) => void;
}

/* A new run of messages shows its sender again after a change of sender or this long a pause. */
const RUN_GAP_MS = 10 * 60_000;
const NEAR_BOTTOM_PX = 120;
const COMPOSER_MAX_PX = 208;

export const AdminSupportConversation: React.FC<Props> = ({ thread, onBack, draft, onDraftChange }) => {
  const { authState } = useAdminAuth();
  const admin = authState.type === "authenticated" ? authState.admin : null;
  const messagesQuery = useAdminThreadMessagesQuery(thread.id);
  const replyMutation = useAdminReplyMutation();
  const statusMutation = useUpdateThreadStatusMutation();
  const refresh = useRefreshAdminSupport();
  const uploads = useSupportAttachmentUploads(postAdminSupportAttachmentUpload);

  const [text, setText] = useState(draft);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showJump, setShowJump] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const stickToBottom = useRef(true);

  const messages = messagesQuery.data;
  const lastMessageId = messages?.[messages.length - 1]?.id;
  const isClosed = thread.status === "closed";
  const pendingStatus = statusMutation.isPending ? statusMutation.variables?.status : undefined;

  const groups = useMemo(() => {
    const now = Date.now();
    const result: { key: string; label: string; items: { message: ThreadMessage; startsRun: boolean }[] }[] = [];
    let previous: ThreadMessage | undefined;
    for (const message of messages ?? []) {
      const key = supportDayKey(message.createdAt);
      let group = result[result.length - 1];
      if (!group || group.key !== key) {
        group = { key, label: supportDayLabel(message.createdAt, now), items: [] };
        result.push(group);
        previous = undefined;
      }
      const startsRun =
        !previous ||
        previous.senderType !== message.senderType ||
        previous.senderId !== message.senderId ||
        new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime() > RUN_GAP_MS;
      group.items.push({ message, startsRun });
      previous = message;
    }
    return result;
  }, [messages]);

  const scrollToBottom = (smooth = false) => {
    const element = scrollRef.current;
    if (element) element.scrollTo({ top: element.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  };

  // Scroll the conversation pane itself; scrollIntoView also moved the page around it.
  useLayoutEffect(() => {
    if (lastMessageId === undefined) return;
    if (stickToBottom.current) scrollToBottom();
    else setShowJump(true);
  }, [lastMessageId]);

  // Image attachments finish loading after the first scroll and push the latest message out of view.
  useEffect(() => {
    const content = contentRef.current;
    if (!content || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (stickToBottom.current) scrollToBottom();
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [messages !== undefined]);

  useLayoutEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = "auto";
    const borders = element.offsetHeight - element.clientHeight;
    element.style.height = `${Math.min(element.scrollHeight + borders, COMPOSER_MAX_PX)}px`;
  }, [text, isClosed]);

  const handleScroll = () => {
    const element = scrollRef.current;
    if (!element) return;
    const nearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < NEAR_BOTTOM_PX;
    stickToBottom.current = nearBottom;
    setShowJump(!nearBottom);
  };

  const updateText = (value: string) => {
    setText(value);
    onDraftChange(value);
  };

  const canSend =
    !isClosed &&
    (text.trim().length > 0 || uploads.attachments.length > 0) &&
    !uploads.isUploading &&
    !uploads.hasFailed &&
    !replyMutation.isPending;

  const send = () => {
    if (!canSend) return;
    stickToBottom.current = true;
    replyMutation.mutate(
      {
        threadId: thread.id,
        message: text.trim(),
        attachments: uploads.attachments,
        senderName: admin?.fullName ?? "Admin",
      },
      {
        onSuccess: () => {
          updateText("");
          uploads.clear();
          textareaRef.current?.focus();
        },
      }
    );
  };

  const changeStatus = (status: SupportThreadStatus) => {
    statusMutation.mutate({ threadId: thread.id, status });
  };

  const refreshThread = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await refresh(thread.id);
    } finally {
      setIsRefreshing(false);
    }
  };

  const statusButton = (status: SupportThreadStatus, label: string, icon: React.ReactNode, variant: "primary" | "outline") => (
    <Button
      key={status}
      variant={variant}
      className={styles.actionButton}
      onClick={() => changeStatus(status)}
      disabled={statusMutation.isPending}
    >
      {pendingStatus === status ? <Loader2 className={styles.spin} /> : icon}
      {label}
    </Button>
  );

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <Button variant="ghost" size="icon-lg" className={styles.back} onClick={onBack} aria-label="Back to all threads">
          <ArrowLeft />
        </Button>

        <div className={styles.headerMain}>
          <div className={styles.titleRow}>
            <h2 className={styles.subject} title={`${thread.subject} (#${thread.id}, opened ${supportDate(thread.createdAt)})`}>
              {thread.subject}
            </h2>
            <Badge variant={supportStatusBadge(thread.status)} className={styles.status}>
              {supportStatusLabel(thread.status)}
            </Badge>
          </div>
          <p className={styles.meta}>
            <span className={styles.teacherName}>{thread.teacherName}</span>
            {thread.teacherEmail && <span className={styles.teacherEmail}>{thread.teacherEmail}</span>}
          </p>
        </div>

        <div className={styles.headerActions}>
          {thread.teacherId !== null && (
            <Button asChild variant="outline" size="icon-lg" className={styles.iconButton}>
              <Link
                to={`/admin/teachers?search=${encodeURIComponent(thread.teacherName)}`}
                aria-label={`Find ${thread.teacherName} in Teachers`}
                title="Find this teacher in Teachers"
              >
                <ExternalLink />
              </Link>
            </Button>
          )}
          <Button
            variant="outline"
            size="icon-lg"
            onClick={refreshThread}
            aria-busy={isRefreshing}
            aria-label="Refresh this conversation"
            title="Refresh this conversation"
            className={styles.iconButton}
          >
            <RefreshCw className={isRefreshing ? styles.spin : undefined} />
          </Button>
          {thread.status === "open" && (
            <>
              {statusButton("closed", "Close", <Archive />, "outline")}
              {statusButton("resolved", "Mark resolved", <CheckCircle />, "primary")}
            </>
          )}
          {thread.status === "resolved" && (
            <>
              {statusButton("closed", "Close", <Archive />, "outline")}
              {statusButton("open", "Reopen", <RotateCcw />, "outline")}
            </>
          )}
          {isClosed && statusButton("open", "Reopen", <RotateCcw />, "outline")}
        </div>
      </header>

      <div className={styles.chatWrap}>
        {messagesQuery.isError && messages && (
          <div className={styles.refreshError} role="alert">
            <AlertCircle size={16} aria-hidden="true" />
            <span className={styles.refreshErrorText}>Could not refresh this conversation. Newer messages may be missing.</span>
          </div>
        )}

        <div ref={scrollRef} className={styles.chat} onScroll={handleScroll} role="log" aria-label="Messages">
          {!messages && messagesQuery.isError ? (
            <div className={styles.state} role="alert">
              <span className={styles.stateIcon} aria-hidden="true">
                <AlertCircle size={22} />
              </span>
              <p className={styles.stateText}>
                {messagesQuery.error instanceof Error && messagesQuery.error.message
                  ? messagesQuery.error.message
                  : "The messages could not be loaded."}
              </p>
              <Button variant="outline" onClick={() => messagesQuery.refetch()}>Try again</Button>
            </div>
          ) : !messages ? (
            <div className={styles.skeleton} aria-busy="true">
              <Skeleton style={{ height: "4rem", width: "55%", alignSelf: "flex-start", borderRadius: "var(--radius-lg)" }} />
              <Skeleton style={{ height: "5rem", width: "60%", alignSelf: "flex-end", borderRadius: "var(--radius-lg)" }} />
              <Skeleton style={{ height: "3rem", width: "40%", alignSelf: "flex-start", borderRadius: "var(--radius-lg)" }} />
            </div>
          ) : messages.length === 0 ? (
            <p className={styles.noMessages}>No messages in this thread yet.</p>
          ) : (
            <div ref={contentRef} className={styles.messages}>
              {groups.map((group) => (
                <section key={group.key} className={styles.day} aria-label={group.label}>
                  <div className={styles.dayDivider}>
                    <span className={styles.dayLabel}>{group.label}</span>
                  </div>
                  {group.items.map(({ message, startsRun }) => {
                    const fromTeam = message.senderType === "admin";
                    const isYou = fromTeam && admin?.id === message.senderId;
                    const hasText = message.messageText.trim() !== "";
                    return (
                      <article
                        key={message.id}
                        className={`${styles.message} ${fromTeam ? styles.fromTeam : styles.fromTeacher} ${startsRun ? styles.startsRun : ""}`}
                      >
                        {startsRun && (
                          <div className={styles.sender}>
                            <span className={styles.senderName}>{isYou ? "You" : message.senderName}</span>
                            {fromTeam && !isYou && <span className={styles.senderRole}>Team</span>}
                          </div>
                        )}
                        {hasText && <div className={styles.bubble}>{linkifyText(message.messageText)}</div>}
                        <SupportAttachmentList attachments={message.attachments ?? []} align={fromTeam ? "end" : "start"} />
                        <time
                          className={styles.time}
                          dateTime={new Date(message.createdAt).toISOString()}
                          title={supportTimestamp(message.createdAt)}
                        >
                          {supportTime(message.createdAt)}
                        </time>
                      </article>
                    );
                  })}
                </section>
              ))}
            </div>
          )}
        </div>

        {showJump && messages && messages.length > 0 && (
          <button
            type="button"
            className={styles.jump}
            onClick={() => {
              stickToBottom.current = true;
              setShowJump(false);
              scrollToBottom(true);
            }}
          >
            <ArrowDown size={16} aria-hidden="true" />
            Latest
          </button>
        )}
      </div>

      <footer className={styles.composer}>
        {isClosed ? (
          <p className={styles.closedText}>This thread is closed. Reopen it to reply.</p>
        ) : (
          <>
            <SupportPendingAttachments items={uploads.items} onRemove={uploads.remove} />
            <div className={styles.composerRow}>
              <Textarea
                ref={textareaRef}
                value={text}
                onChange={(event) => updateText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                    event.preventDefault();
                    send();
                  }
                }}
                rows={1}
                disableResize
                placeholder={`Reply to ${thread.teacherName}`}
                aria-label="Reply"
                className={styles.textarea}
              />
              <div className={styles.composerActions}>
                <SupportAttachButton onFiles={uploads.addFiles} disabled={replyMutation.isPending} />
                <Button onClick={send} disabled={!canSend} className={styles.sendButton} title="Send (Ctrl + Enter)">
                  {replyMutation.isPending ? <Loader2 className={styles.spin} /> : <Send />}
                  {replyMutation.isPending ? "Sending" : "Send"}
                </Button>
              </div>
            </div>
          </>
        )}
      </footer>
    </div>
  );
};