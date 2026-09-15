import React from "react";
import { Skeleton } from "./Skeleton";
import styles from "./TestCardSkeleton.module.css";

export const TestCardSkeleton: React.FC = () => {
  return (
    <div className={styles.card}>
      {/* Top Badge */}
      <div className={styles.badgeContainer}>
                <Skeleton style={{ width: "120px", height: "1.75rem", borderRadius: "var(--radius)" }} />
      </div>

      {/* Thumbnail */}
      <div className={styles.thumbnail}>
        <Skeleton style={{ width: "100%", height: "100%" }} />
      </div>

      {/* Card Content */}
      <div className={styles.cardContent}>
        {/* Title - 2 lines */}
        <div className={styles.titleContainer}>
          <Skeleton style={{ width: "100%", height: "1.375rem" }} />
          <Skeleton style={{ width: "75%", height: "1.375rem" }} />
        </div>

        {/* Creator */}
        <Skeleton style={{ width: "140px", height: "1rem" }} />

        {/* Info Grid - 3 rows */}
        <div className={styles.infoGrid}>
          <div className={styles.infoRow}>
            <Skeleton style={{ width: "16px", height: "16px" }} />
            <Skeleton style={{ width: "180px", height: "0.875rem" }} />
          </div>
          <div className={styles.infoRow}>
            <Skeleton style={{ width: "16px", height: "16px" }} />
            <Skeleton style={{ width: "160px", height: "0.875rem" }} />
          </div>
          <div className={styles.infoRow}>
            <Skeleton style={{ width: "16px", height: "16px" }} />
            <Skeleton style={{ width: "200px", height: "0.875rem" }} />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className={styles.cardFooter}>
        <Skeleton style={{ width: "180px", height: "2.5rem", borderRadius: "var(--radius)" }} />
        <Skeleton style={{ width: "100px", height: "2rem" }} />
      </div>
    </div>
  );
};