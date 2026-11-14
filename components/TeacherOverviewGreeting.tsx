import React from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Radio } from "lucide-react";
import { useLiveTeachingStatusPeek } from "../helpers/useLiveTeaching";
import { useTeacherMentorshipRateQuery } from "../helpers/useTeacherMentorship";
import styles from "./TeacherOverviewGreeting.module.css";

const partOfDay = (hour: number) => (hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening");

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "T";

/* Approved teachers carry their live teaching state here instead of in a card. */
const LiveChip: React.FC = () => {
  const { data: rate } = useTeacherMentorshipRateQuery();
  if (!rate) return null;
  const on = rate.enabled;
  return (
    <Link to="/teacher/mentorship" className={styles.chip} data-tone={on ? "mint" : "butter"}>
      <span className={styles.chipDot} aria-hidden="true" />
      {on ? "Live teaching on" : "1:1 bookings off"}
    </Link>
  );
};

/*
 * The dashboard header: a tilted avatar tile, a time-of-day greeting and the
 * date, with small status chips on the right. The period switch lives in the
 * earnings panel it controls, not up here.
 */
export const TeacherOverviewGreeting: React.FC<{
  name: string;
  avatarUrl: string | null;
  profileSlug: string | null;
}> = ({ name, avatarUrl, profileSlug }) => {
  const { data: live } = useLiveTeachingStatusPeek(true);
  const now = new Date();
  const first = name.trim().split(/\s+/)[0] || "there";
  const date = now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

  return (
    <header className={styles.header}>
      <div className={styles.who}>
        <span className={styles.avatarWrap} aria-hidden="true">
          <span className={styles.avatarBack} />
          <span className={styles.avatar}>
            {avatarUrl ? <img src={avatarUrl} alt="" /> : <span>{initials(name)}</span>}
          </span>
        </span>
        <div className={styles.text}>
          <p className={styles.date}>{date}</p>
          <h1 className={styles.title}>
            {partOfDay(now.getHours())}, <span className={styles.name}>{first}</span>
          </h1>
        </div>
      </div>
      <div className={styles.chips}>
        {live?.status === "approved" && <LiveChip />}
        {live?.status === "pending" && (
          <Link to="/teacher/mentorship" className={styles.chip} data-tone="lavender">
            <Radio size={13} aria-hidden="true" />
            Live teaching in review
          </Link>
        )}
        {profileSlug && (
          <a href={`/expert/${profileSlug}`} target="_blank" rel="noreferrer" className={styles.chip}>
            Public profile
            <ArrowUpRight size={14} aria-hidden="true" />
          </a>
        )}
      </div>
    </header>
  );
};