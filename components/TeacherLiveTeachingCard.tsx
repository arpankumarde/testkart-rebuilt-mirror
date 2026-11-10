import React from "react";
import { Link } from "react-router-dom";
import { Video, Users, ArrowRight } from "lucide-react";
import { useMentorshipTeacherOfferingsQuery, useMentorshipGroupLessonsListQuery } from "../helpers/useMentorship";
import { groupLessonPath, GROUP_LESSON_LIST_PATH } from "../helpers/groupLessonRoutes";
import { liveBookingPath } from "../helpers/liveBookingRoutes";
import { trialPriceFor, LiveClassMinutes } from "../helpers/livePricing";
import { LiveSessionDateTile, formatSessionTime, relativeDayLabel } from "./LiveSession";
import styles from "./TeacherLiveTeachingCard.module.css";

interface TeacherLiveTeachingCardProps {
  teacherId: number;
  teacherSlug: string | null;
  teacherName: string;
  /* The profile's own section and heading classes, so this lines up with the other sections. */
  className?: string;
  titleClassName?: string;
}

const formatPrice = (price: number) => (price > 0 ? `₹${price.toLocaleString("en-IN")}` : "Free");

const TONES = ["lavender", "blue", "sage"] as const;

/**
 * "Learn live" section on the public teacher profile. It shows only for a
 * teacher approved for live teaching who has switched on 1:1 sessions (with a
 * valid rate), or who has an open group class; everyone else gets nothing,
 * including while it loads, so their profile is unchanged. The intro video sits
 * beside the 1:1 panel on wide screens; the panel lists trial and class prices
 * as compact rows, and every booking link opens the booking page. Data comes
 * from mentorship/teacher-offerings_GET and mentorship/group-lessons/list_GET,
 * not from teachers/profile_GET, so the profile's SSR cache and structured data
 * are untouched.
 */
export const TeacherLiveTeachingCard: React.FC<TeacherLiveTeachingCardProps> = ({
  teacherId,
  teacherSlug,
  teacherName,
  className,
  titleClassName,
}) => {
  const offeringsQuery = useMentorshipTeacherOfferingsQuery(teacherId);
  const groupLessonsQuery = useMentorshipGroupLessonsListQuery({ teacherId, limit: 3 });

  const offerings = offeringsQuery.data;
  const prices = offerings?.enabled ? offerings.prices : null;
  const durations = prices ? offerings!.durations : [];
  const groupLessons = groupLessonsQuery.data?.groupLessons ?? [];
  const introVideoUrl = offerings?.introVideoUrl ?? null;

  if (durations.length === 0 && groupLessons.length === 0) {
    return null;
  }

  const hasPrivate = durations.length > 0 && !!prices;
  const hasGroup = groupLessons.length > 0;
  const videoBesidePanel = !!introVideoUrl && hasPrivate;
  const pastTrial = offerings?.trialState === "done" || !!offerings?.activePackageId;
  const teacherRef = { slug: teacherSlug };

  const video = introVideoUrl && (
    <div className={videoBesidePanel ? styles.introBeside : styles.intro}>
      <video
        className={styles.introVideo}
        src={introVideoUrl}
        controls
        preload="metadata"
        playsInline
        aria-label={`Intro video from ${teacherName}`}
      />
    </div>
  );

  const gridClass = videoBesidePanel ? styles.gridVideo : hasPrivate && hasGroup ? styles.gridTwo : "";

  return (
    <section id="live" className={`${styles.root} ${className ?? ""}`} aria-labelledby="live-teaching-heading">
      <h2 id="live-teaching-heading" className={titleClassName ?? styles.title}>
        Learn live with {teacherName}
      </h2>

      {!videoBesidePanel && video}

      <div className={`${styles.grid} ${gridClass}`}>
        {videoBesidePanel && video}

        {hasPrivate && prices && (
          <div className={`${styles.panel} ${styles.panelPrivate}`}>
            <div className={styles.panelHead}>
              <span className={styles.panelIcon} aria-hidden="true">
                <Video size={18} />
              </span>
              <div>
                <h3 className={styles.panelTitle}>1:1 video classes</h3>
                <p className={styles.panelText}>Just you and {teacherName}, at a time that suits you.</p>
              </div>
            </div>

            <dl className={styles.rates}>
              {!pastTrial && (
                <div className={styles.rateRow}>
                  <dt className={styles.rateLabel}>Trial class</dt>
                  <dd className={styles.rateOptions}>
                    {durations.map((d) => (
                      <Link
                        key={d.durationMinutes}
                        to={liveBookingPath(teacherRef, d.durationMinutes)}
                        className={`${styles.rate} ${styles.rateLink}`}
                      >
                        <span className={styles.rateLength}>{d.durationMinutes} min</span>
                        <span className={styles.ratePrice}>
                          {formatPrice(trialPriceFor(prices, d.durationMinutes as LiveClassMinutes))}
                        </span>
                      </Link>
                    ))}
                  </dd>
                </div>
              )}
              <div className={styles.rateRow}>
                <dt className={styles.rateLabel}>{pastTrial ? "Per class" : "After the trial"}</dt>
                <dd className={styles.rateOptions}>
                  {durations.map((d) => (
                    <span key={d.durationMinutes} className={styles.rate}>
                      <span className={styles.rateLength}>{d.durationMinutes} min</span>
                      <span className={styles.ratePrice}>{formatPrice(d.price)}</span>
                    </span>
                  ))}
                </dd>
              </div>
            </dl>
            <p className={styles.panelNote}>1 to 6 classes a week, booked 4 weeks at a time.</p>

            <Link to={liveBookingPath(teacherRef)} className={styles.cta}>
              {pastTrial ? "Book classes" : "Book trial session"} <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        )}

        {hasGroup && (
          <div className={`${styles.panel} ${styles.panelGroup}`}>
            <div className={styles.panelHead}>
              <span className={styles.panelIcon} aria-hidden="true">
                <Users size={18} />
              </span>
              <div>
                <h3 className={styles.panelTitle}>Live group classes</h3>
                <p className={styles.panelText}>Join a small class and learn with others.</p>
              </div>
            </div>

            <ul className={styles.lessons}>
              {groupLessons.map((lesson, i) => {
                const seatsLeft = Math.max(lesson.maxCapacity - lesson.enrolledCount, 0);
                const relative = relativeDayLabel(lesson.startTime);
                return (
                  <li key={lesson.id}>
                    <Link to={groupLessonPath(lesson.id)} className={styles.lesson}>
                      <LiveSessionDateTile date={lesson.startTime} tone={TONES[i % TONES.length]} />
                      <span className={styles.lessonBody}>
                        <span className={styles.lessonTitle}>{lesson.title}</span>
                        <span className={styles.lessonMeta}>
                          {relative ? `${relative}, ` : ""}
                          {formatSessionTime(lesson.startTime)} &middot; {lesson.durationMinutes} min &middot;{" "}
                          {seatsLeft > 0 ? `${seatsLeft} seats left` : "Full"}
                        </span>
                      </span>
                      <span className={`${styles.lessonPrice} ${lesson.pricePerLearner > 0 ? "" : styles.free}`}>
                        {formatPrice(lesson.pricePerLearner)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>

            <Link to={GROUP_LESSON_LIST_PATH} className={styles.moreLink}>
              All live classes <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
};
