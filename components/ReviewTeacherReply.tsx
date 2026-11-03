import React from "react";
import styles from "./ReviewTeacherReply.module.css";

type Props = {
  reply: string | null | undefined;
  repliedAt?: Date | string | null;
  /** Shown as "Reply from {name}"; falls back to "the teacher". */
  teacherName?: string | null;
};

/** The teacher's public answer under a student review. Renders nothing without one. */
export const ReviewTeacherReply = ({ reply, repliedAt, teacherName }: Props) => {
  const text = reply?.trim();
  if (!text) return null;
  return (
    <div className={styles.reply}>
      <span className={styles.head}>
        Reply from {teacherName?.trim() || "the teacher"}
        {repliedAt && (
          <span className={styles.date}>
            {new Date(repliedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
          </span>
        )}
      </span>
      <p className={styles.text}>{text}</p>
    </div>
  );
};