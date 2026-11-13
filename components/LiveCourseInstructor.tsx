import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQueries } from "@tanstack/react-query";
import { ArrowRight, Award, BadgeCheck, BookOpen, GraduationCap, Star, Users } from "lucide-react";
import type { OutputType as LiveCourseViewData } from "../endpoints/live-courses/get_GET.schema";
import type { OutputType as TeacherProfile } from "../endpoints/teachers/profile_GET.schema";
import { getReviewsList } from "../endpoints/reviews/list_GET.schema";
import { computeTeacherProfileStats, formatStatCount } from "../helpers/teacherProfileStats";
import styles from "./LiveCourseInstructor.module.css";

type Course = LiveCourseViewData["course"];

const BIO_CLAMP = 420;

export const LiveCourseInstructor: React.FC<{ course: Course; profile: TeacherProfile | undefined }> = ({ course, profile }) => {
  const [bioOpen, setBioOpen] = useState(false);
  const t = course.teacher;
  const stats = profile ? computeTeacherProfileStats(profile) : null;
  const bio = (course.teacherBio ?? profile?.teacher.bio ?? "").trim();
  const longBio = bio.length > BIO_CLAMP;
  const expertise = (profile?.teacher.expertiseAreas ?? [])
    .map((e) => (typeof e === "string" ? e : e.examName))
    .filter((e): e is string => !!e && e.trim().length > 0)
    .slice(0, 6);
  const href = t.slug ? `/expert/${t.slug}` : null;

  const figures = [
    stats && stats.students > 0 && { icon: <Users size={16} />, value: formatStatCount(stats.students), label: "learners" },
    stats && stats.catalogue > 0 && { icon: <BookOpen size={16} />, value: String(stats.catalogue), label: "courses and tests" },
    stats?.yearsTeaching && { icon: <GraduationCap size={16} />, value: `${stats.yearsTeaching}+`, label: "years teaching" },
    stats && stats.exams.length > 0 && { icon: <Award size={16} />, value: String(stats.exams.length), label: stats.exams.length === 1 ? "exam covered" : "exams covered" },
  ].filter(Boolean) as { icon: React.ReactNode; value: string; label: string }[];

  const avatar = t.avatarUrl ? (
    <img src={t.avatarUrl} alt="" className={styles.avatar} />
  ) : (
    <span className={styles.avatarFallback} aria-hidden="true">
      {t.name.charAt(0).toUpperCase()}
    </span>
  );

  return (
    <div className={styles.card}>
      <div className={styles.profile}>
        <span className={styles.portrait}>{avatar}</span>
        <span className={styles.nameRow}>
          {href ? (
            <Link to={href} className={styles.name}>
              {t.name}
            </Link>
          ) : (
            <span className={styles.name}>{t.name}</span>
          )}
          {profile?.teacher.isVerified && <BadgeCheck size={18} className={styles.verifiedIcon} aria-label="Verified teacher" />}
        </span>
        {course.teacherTagline && <span className={styles.tagline}>{course.teacherTagline}</span>}
        {profile?.teacher.academyName && <span className={styles.academy}>{profile.teacher.academyName}</span>}
        {href && (
          <Link to={href} className={styles.profileLink}>
            View full profile <ArrowRight size={15} aria-hidden="true" />
          </Link>
        )}
      </div>

      <div className={styles.details}>
        {figures.length > 0 && (
          <ul className={styles.figures}>
            {figures.map((f) => (
              <li key={f.label} className={styles.figure}>
                <span className={styles.figureIcon} aria-hidden="true">
                  {f.icon}
                </span>
                <span className={styles.figureText}>
                  <strong>{f.value}</strong>
                  <span>{f.label}</span>
                </span>
              </li>
            ))}
          </ul>
        )}

        {bio && (
          <div className={styles.bioWrap}>
            <h3 className={styles.bioTitle}>About {t.name}</h3>
            <p className={`${styles.bio} ${longBio && !bioOpen ? styles.bioClamped : ""}`}>{bio}</p>
            {longBio && (
              <button type="button" className={styles.more} aria-expanded={bioOpen} onClick={() => setBioOpen((v) => !v)}>
                {bioOpen ? "Show less" : "Read more"}
              </button>
            )}
          </div>
        )}

        {expertise.length > 0 && (
          <div className={styles.expertiseWrap}>
            <span className={styles.expertiseLabel}>Teaches for</span>
            <ul className={styles.expertise}>
              {expertise.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

const SOURCES = 3;
const PAGE = 4;

const Stars: React.FC<{ value: number; size?: number }> = ({ value, size = 15 }) => (
  <span className={styles.stars} aria-hidden="true">
    {[1, 2, 3, 4, 5].map((i) => (
      <Star key={i} size={size} className={i <= Math.round(value) ? styles.starOn : styles.starOff} />
    ))}
  </span>
);

/**
 * Live courses carry no reviews of their own, so this shows real reviews from the teacher's
 * most-reviewed test series, labelled as such. Draws nothing when there are none.
 */
export const LiveCourseReviews: React.FC<{
  teacherName: string;
  profile: TeacherProfile | undefined;
  wrap?: (content: React.ReactElement) => React.ReactElement;
}> = ({ teacherName, profile, wrap = (content) => content }) => {
  const [shown, setShown] = useState(PAGE);
  const sources = useMemo(
    () =>
      (profile?.tests ?? [])
        .filter((t) => Number(t.reviewsCount ?? 0) > 0)
        .sort((a, b) => Number(b.reviewsCount ?? 0) - Number(a.reviewsCount ?? 0))
        .slice(0, SOURCES),
    [profile]
  );
  const results = useQueries({
    queries: sources.map((s) => ({
      queryKey: ["reviews", "list", s.id],
      queryFn: () => getReviewsList({ mockTestId: s.id }),
      staleTime: 10 * 60 * 1000,
    })),
  });

  const reviews = useMemo(
    () =>
      results
        .flatMap((r, i) => (r.data?.reviews ?? []).map((rev) => ({ ...rev, source: sources[i]?.title ?? "" })))
        .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()),
    [results, sources]
  );

  if (reviews.length === 0) return null;

  const total = reviews.length;
  const average = reviews.reduce((n, r) => n + r.rating, 0) / total;
  const dist = [5, 4, 3, 2, 1].map((stars) => ({ stars, count: reviews.filter((r) => Math.round(r.rating) === stars).length }));
  const written = reviews.filter((r) => (r.reviewText ?? "").trim().length > 0);

  return wrap(
    <div className={styles.reviews}>
      <p className={styles.reviewsNote}>
        This live batch has no reviews yet. These are from students of {teacherName}'s test series on Testkart.
      </p>
      <div className={styles.reviewsGrid}>
        <div className={styles.summary}>
          <strong className={styles.average}>{average.toFixed(1)}</strong>
          <Stars value={average} size={18} />
          <span className={styles.count}>
            {total} {total === 1 ? "rating" : "ratings"}
          </span>
          <span className={styles.srOnly}>Average {average.toFixed(1)} out of 5</span>
          <ul className={styles.dist}>
            {dist.map((d) => (
              <li key={d.stars}>
                <span className={styles.distLabel}>
                  {d.stars} <Star size={12} aria-hidden="true" />
                </span>
                <span className={styles.bar} aria-hidden="true">
                  <span style={{ width: `${(d.count / total) * 100}%` }} />
                </span>
                <span className={styles.distCount}>{d.count}</span>
              </li>
            ))}
          </ul>
        </div>

        {written.length > 0 && (
          <div className={styles.reviewList}>
            <ul>
              {written.slice(0, shown).map((r) => (
                <li key={r.id} className={styles.review}>
                  <div className={styles.reviewHead}>
                    {r.reviewerAvatarUrl ? (
                      <img src={r.reviewerAvatarUrl} alt="" className={styles.reviewAvatar} />
                    ) : (
                      <span className={styles.reviewAvatarFallback} aria-hidden="true">
                        {r.reviewerName.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className={styles.reviewWho}>
                      <strong>{r.reviewerName}</strong>
                      {r.createdAt && (
                        <span>{new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                      )}
                    </span>
                    <span className={styles.reviewRating}>
                      <Stars value={r.rating} size={13} />
                      <span className={styles.srOnly}>{r.rating} out of 5</span>
                    </span>
                  </div>
                  <p className={styles.reviewText}>{r.reviewText}</p>
                  <span className={styles.reviewSource}>On {r.testItemTitle || r.source}</span>
                  {r.teacherReply && (
                    <p className={styles.reply}>
                      <strong>{teacherName} replied:</strong> {r.teacherReply}
                    </p>
                  )}
                </li>
              ))}
            </ul>
            {written.length > shown && (
              <button type="button" className={styles.showMore} onClick={() => setShown((n) => n + PAGE)}>
                Show more reviews
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
