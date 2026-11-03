import React from "react";
import { Skeleton } from "./Skeleton";
import styles from "./TeacherTestCardSkeleton.module.css";

/* The loading stand-in for TeacherTestCard and TeacherCourseCard, which share
   one shell: cover, text rows, stats line and footer. */
export const TeacherTestCardSkeleton: React.FC = () => (
  <div className={styles.card} aria-hidden="true">
    <div className={styles.cover}>
      <Skeleton className={styles.fill} />
      <span className={styles.badge} />
    </div>

    <div className={styles.body}>
      <Skeleton className={styles.eyebrow} />
      <Skeleton className={styles.line} />
      <Skeleton className={`${styles.line} ${styles.lineShort}`} />
    </div>

    <div className={styles.metrics}>
      <Skeleton className={styles.metric} />
      <Skeleton className={styles.metric} />
      <Skeleton className={styles.metric} />
    </div>

    <div className={styles.footer}>
      <Skeleton className={styles.price} />
      <div className={styles.actions}>
        <Skeleton className={styles.edit} />
        <Skeleton className={styles.more} />
      </div>
    </div>
  </div>
);
