import React from "react";
import { useTeacherAvatarsQuery } from "../helpers/useTeacherAvatarsQuery";
import { Skeleton } from "./Skeleton";
import styles from "./TeacherAvatarsScroll.module.css";

const AvatarItem = ({
  name,
  url,
}: {
  name: string;
  url: string | null;
}) => {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className={styles.avatarWrapper} title={name}>
      {url ? (
        <img
          src={url}
          alt={name}
          className={styles.avatarImage}
          loading="lazy"
        />
      ) : (
        <div className={styles.avatarFallback}>{initials}</div>
      )}
    </div>
  );
};

export const TeacherAvatarsScroll: React.FC = () => {
  const { data, isLoading, isError } = useTeacherAvatarsQuery();

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.label}>Join 50,000+ Educators</div>
        <div className={styles.skeletonContainer}>
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className={styles.avatarSkeleton} />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !data || data.teachers.length === 0) {
    return null;
  }

  // Duplicate the list to create a seamless loop
  // If we have fewer than 20 items, duplicate more times to fill the screen
  const originalList = data.teachers;
  const multiplier = originalList.length < 20 ? 4 : 2;
  const scrollList = Array(multiplier).fill(originalList).flat();

  return (
    <div className={styles.container}>
      <div className={styles.label}>Join 50,000+ Educators</div>
      
      <div className={styles.scrollMask}>
        <div className={styles.scrollTrack}>
          {scrollList.map((teacher, index) => (
            <AvatarItem
              key={`${teacher.displayName}-${index}`}
              name={teacher.displayName}
              url={teacher.avatarUrl}
            />
          ))}
        </div>
      </div>
      
      {/* Gradient overlays for smooth fade effect at edges */}
      <div className={styles.fadeLeft}></div>
      <div className={styles.fadeRight}></div>
    </div>
  );
};