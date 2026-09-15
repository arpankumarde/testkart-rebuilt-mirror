import React, { useState, useRef, useEffect } from "react";
import { Button } from "./Button";
import { Textarea } from "./Textarea";
import { Badge } from "./Badge";
import { Skeleton } from "./Skeleton";
import { ArrowLeft, Send } from "lucide-react";
import {
  useThreadMessagesQuery,
  useReplyToThreadMutation,
} from "../helpers/useTeacherSupport";
import { SupportThreadWithUnread } from "../endpoints/teacher/support/threads_GET.schema";
import { formatMessageTime } from "../helpers/formatTime";
import { linkifyText } from "../helpers/linkifyText";
import styles from "./TeacherSupportMessageView.module.css";

interface Props {
  threadId: number;
  thread: SupportThreadWithUnread;
  onBack: () => void;
  className?: string;
}

export const TeacherSupportMessageView: React.FC<Props> = ({
  threadId,
  thread,
  onBack,
  className,
}) => {
  const messagesQuery = useThreadMessagesQuery(threadId);
  const replyMutation = useReplyToThreadMutation();
  const [replyText, setReplyText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messagesQuery.data]);

  const handleSend = async () => {
    if (!replyText.trim()) return;
    try {
      await replyMutation.mutateAsync({ threadId, message: replyText.trim() });
      setReplyText("");
    } catch (error) {
      // Handled natively by the mutation's onError wrapper
    }
  };

  return (
    <div className={`${styles.container} ${className || ""}`}>
      <header className={styles.header}>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onBack}
          className={styles.backButton}
        >
          <ArrowLeft size={16} />
        </Button>
        <div className={styles.headerContent}>
          <h2 className={styles.subject}>{thread.subject}</h2>
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
        </div>
      </header>

      <div className={styles.messagesArea}>
        {messagesQuery.isFetching && !messagesQuery.data ? (
          <div className={styles.loadingState}>
            <Skeleton
              className={styles.skeletonMessage}
              style={{ alignSelf: "flex-end" }}
            />
            <Skeleton
              className={styles.skeletonMessage}
              style={{ alignSelf: "flex-start" }}
            />
            <Skeleton
              className={styles.skeletonMessage}
              style={{ alignSelf: "flex-end" }}
            />
          </div>
        ) : (
          <div className={styles.messageList}>
            {messagesQuery.data?.map((msg) => {
              const isYou = msg.senderType === "teacher";
              return (
                <div
                  key={msg.id}
                  className={`${styles.messageWrapper} ${
                    isYou ? styles.wrapperYou : styles.wrapperAdmin
                  }`}
                >
                  <span className={styles.senderName}>
                    {isYou ? "You" : "Admin"}
                  </span>
                  <div
                    className={`${styles.messageBubble} ${
                      isYou ? styles.bubbleYou : styles.bubbleAdmin
                    }`}
                  >
                    <p className={styles.messageText}>{linkifyText(msg.messageText)}</p>
                    <span className={styles.messageTime}>
                      {formatMessageTime(msg.createdAt)}
                    </span>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className={styles.replyArea}>
        {thread.status === "closed" ? (
          <p className={styles.closedNote}>This thread has been closed.</p>
        ) : (
          <div className={styles.replyInputWrapper}>
            <Textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Type your message here..."
              className={styles.replyTextarea}
              disableResize
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <Button
              onClick={handleSend}
              disabled={!replyText.trim() || replyMutation.isPending}
              className={styles.sendButton}
            >
              {replyMutation.isPending ? "..." : <Send size={16} />}
              <span className={styles.sendText}>Send</span>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};