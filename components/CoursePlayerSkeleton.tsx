import React from 'react';
import { Skeleton } from './Skeleton';
import styles from './CoursePlayerSkeleton.module.css';

export const CoursePlayerSkeleton: React.FC = () => {
  return (
    <div className={styles.playerLayout}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <Skeleton className={styles.backButtonSkeleton} />
          <Skeleton className={styles.titleSkeleton} />
          <div className={styles.progressContainer}>
            <Skeleton className={styles.progressTextSkeleton} />
            <Skeleton className={styles.progressBarSkeleton} />
          </div>
        </div>
        <div className={styles.curriculum}>
          {[1, 2].map(sectionKey => (
            <div key={sectionKey} className={styles.section}>
              <Skeleton className={styles.sectionTitleSkeleton} />
              <ul className={styles.lessonsList}>
                {[1, 2, 3].map(lessonKey => (
                  <li key={lessonKey} className={styles.lessonItem}>
                    <Skeleton className={styles.lessonIconSkeleton} />
                    <div className={styles.lessonDetails}>
                      <Skeleton className={styles.lessonTitleSkeleton} />
                      <Skeleton className={styles.lessonMetaSkeleton} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </aside>

      <main className={styles.mainContent}>
        <div className={styles.contentHeader}>
          <Skeleton className={styles.headerTitleSkeleton} />
        </div>
        <div className={styles.contentArea}>
          <Skeleton className={styles.contentBlockSkeleton} />
        </div>
        <div className={styles.contentFooter}>
          <Skeleton className={styles.footerButtonSkeleton} />
          <Skeleton className={styles.footerButtonSkeleton} />
          <Skeleton className={styles.footerButtonSkeleton} />
        </div>
      </main>
    </div>
  );
};