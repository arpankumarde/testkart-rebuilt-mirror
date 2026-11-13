import React from "react";
import { BookOpenCheck, IndianRupee, Star, Users, type LucideIcon } from "lucide-react";
import { useTeacherAvatarsQuery } from "../helpers/useTeacherAvatarsQuery";
import styles from "./SellLandingTrust.module.css";

export type SellTrustTone = "mint" | "blue" | "butter" | "peach" | "lavender";
export type SellTrustStat = {
  icon: LucideIcon;
  tone: SellTrustTone;
  value: string;
  label: string;
};

const TONE_CLASS: Record<SellTrustTone, string> = {
  mint: styles.toneMint,
  blue: styles.toneBlue,
  butter: styles.toneButter,
  peach: styles.tonePeach,
  lavender: styles.toneLavender,
};

/*
 * The figures and labels the /sell page showed before the 19-11-2026 redesign,
 * carried over unchanged from SellPageStatsBar (counted from the live database
 * on 13-10-2026). Update both together by hand. The /sell sub-pages pass their
 * own stats next to the same educator count.
 */
const EDUCATORS = { value: "11,000+", label: "Educators" };

const DEFAULT_STATS: SellTrustStat[] = [
  {
    icon: IndianRupee,
    tone: "mint",
    value: "₹72,000+",
    label: "Paid to Teachers",
  },
  {
    icon: Users,
    tone: "blue",
    value: "6,800+",
    label: "Students",
  },
  {
    icon: Star,
    tone: "butter",
    value: "4.4★",
    label: "Average Review",
  },
];

const AVATAR_TONES = [
  styles.toneLavender,
  styles.tonePeach,
  styles.toneBlue,
  styles.toneMint,
  styles.toneButter,
];

const initialsOf = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

/*
 * The educator marquee from TeacherAvatarsScroll, fitted into the stats card:
 * the same random teacher avatars, the same doubled track sliding by half its
 * width on a loop, paused on hover. The first copy of each photo loads eagerly
 * so avatars do not pop in while sliding into view; the repeats hit the cache.
 * Placeholder circles hold the space while the list loads or if it fails.
 */
const EducatorMarquee = () => {
  const { data } = useTeacherAvatarsQuery();
  const teachers = data?.teachers ?? [];

  if (teachers.length === 0) {
    return (
      <div className={styles.marquee} aria-hidden="true">
        <div className={styles.placeholderRow}>
          {AVATAR_TONES.map((tone, index) => (
            <span key={index} className={`${styles.avatar} ${tone}`}>
              <BookOpenCheck size={16} />
            </span>
          ))}
        </div>
      </div>
    );
  }

  const copies = teachers.length < 20 ? 4 : 2;
  const track = Array.from({ length: copies }, () => teachers).flat();

  return (
    <div className={styles.marquee} aria-hidden="true">
      <div className={styles.track}>
        {track.map((teacher, index) => (
          <span
            key={`${teacher.displayName}-${index}`}
            className={styles.avatar}
            title={teacher.displayName}
          >
            {teacher.avatarUrl ? (
              <img
                src={teacher.avatarUrl}
                alt=""
                className={styles.avatarImage}
                width={44}
                height={44}
                loading={index < teachers.length ? "eager" : "lazy"}
                decoding="async"
              />
            ) : (
              <span className={styles.avatarInitials}>
                {initialsOf(teacher.displayName)}
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
};

export const SellLandingTrust = ({
  stats = DEFAULT_STATS,
}: {
  stats?: SellTrustStat[];
}) => (
  <section className={styles.section} aria-label="Testkart in numbers">
    <div className={styles.strip}>
      <div className={styles.community}>
        <EducatorMarquee />
        <p className={styles.communityText}>
          <strong>{EDUCATORS.value}</strong>
          <span>{EDUCATORS.label}</span>
        </p>
      </div>

      <ul className={styles.stats}>
        {stats.map(({ icon: Icon, tone, value, label }) => (
          <li key={label} className={styles.stat}>
            <span className={`${styles.statIcon} ${TONE_CLASS[tone]}`} aria-hidden="true">
              <Icon size={18} />
            </span>
            <span className={styles.statText}>
              <strong>{value}</strong>
              <span>{label}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  </section>
);
