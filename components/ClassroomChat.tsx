import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { SendHorizontal, MessageSquare } from "lucide-react";
import type { ChatMessageOut } from "../endpoints/mentorship/classroom/chat/list_GET.schema";
import { ClassroomAvatar } from "./ClassroomVideoTile";
import styles from "./ClassroomChat.module.css";

const timeFormat = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
const GROUP_GAP_MS = 3 * 60 * 1000;

interface ClassroomChatProps {
  messages: ChatMessageOut[];
  viewerId: number | null;
  isLoading: boolean;
  isSending: boolean;
  /** Resolves true when the message was saved, so the draft can be cleared. */
  onSend: (body: string) => Promise<boolean>;
}

/** Meeting chat: messages are saved by the chat endpoint and pushed to the others over the call. */
export const ClassroomChat: React.FC<ClassroomChatProps> = ({ messages, viewerId, isLoading, isSending, onSend }) => {
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const stickToBottom = useRef(true);

  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [draft]);

  const submit = async () => {
    const body = draft.trim();
    if (!body || isSending) return;
    stickToBottom.current = true;
    if (await onSend(body)) setDraft("");
  };

  return (
    <div className={styles.chat}>
      <div
        ref={listRef}
        className={styles.list}
        role="log"
        aria-live="polite"
        aria-label="Chat messages"
        onScroll={(e) => {
          const el = e.currentTarget;
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
        }}
      >
        {messages.length === 0 ? (
          <div className={styles.empty}>
            <MessageSquare size={22} aria-hidden="true" />
            <p>{isLoading ? "Loading messages..." : "No messages yet. Say hello, share a link or ask a question."}</p>
          </div>
        ) : (
          messages.map((m, i) => {
            const prev = messages[i - 1];
            const created = new Date(m.createdAt);
            const grouped =
              !!prev && prev.senderId === m.senderId && created.getTime() - new Date(prev.createdAt).getTime() < GROUP_GAP_MS;
            const mine = m.senderId === viewerId;
            return (
              <div key={m.id} className={`${styles.row} ${mine ? styles.rowMine : ""} ${grouped ? styles.rowGrouped : ""}`}>
                {!mine && (
                  <span className={styles.avatarSlot}>{!grouped && <ClassroomAvatar name={m.senderName} src={m.senderAvatarUrl} size="sm" />}</span>
                )}
                <div className={styles.stack}>
                  {!grouped && (
                    <div className={styles.meta}>
                      <span className={styles.sender}>{mine ? "You" : m.senderName}</span>
                      <time className={styles.time} dateTime={created.toISOString()}>
                        {timeFormat.format(created)}
                      </time>
                    </div>
                  )}
                  <p className={`${styles.bubble} ${mine ? styles.bubbleMine : ""}`}>{m.body}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form
        className={styles.composer}
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <textarea
          ref={inputRef}
          className={styles.input}
          rows={1}
          value={draft}
          maxLength={2000}
          placeholder="Send a message"
          aria-label="Chat message"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void submit();
            }
          }}
        />
        <button type="submit" className={styles.send} disabled={!draft.trim() || isSending} aria-label="Send message" title="Send (Enter)">
          <SendHorizontal size={18} aria-hidden="true" />
        </button>
      </form>
      <p className={styles.help}>Enter to send, Shift + Enter for a new line</p>
    </div>
  );
};
