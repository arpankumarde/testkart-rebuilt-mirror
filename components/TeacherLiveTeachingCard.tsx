import React from "react";
import { Link } from "react-router-dom";
import { Video, Users, Clock, ArrowRight, Sparkles } from "lucide-react";
import { useMentorshipTeacherOfferingsQuery, useMentorshipGroupLessonsListQuery } from "../helpers/useMentorship";
import { groupLessonPath, GROUP_LESSON_LIST_PATH } from "../helpers/groupLessonRoutes";
import { LiveSessionDateTile, formatSessionTime, relativeDayLabel } from "./LiveSession";
import styles from "./TeacherLiveTeachingCard.module.css";

interface TeacherLiveTeachingCardProps {
  teacherId: number;
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
 * including while it loads, so their profile is unchanged. Approved teachers'
 * intro videos play at the top. Data comes from mentorship/teacher-offerings_GET and
 * mentorship/group-lessons/list_GET, not from teachers/profile_GET, so the
 * profile's SSR cache and structured data are untouched.
 */
export const TeacherLiveTeachingCard: React.FC<TeacherLiveTeachingCardProps> = ({
  teacherId,
  teacherName,
  className,
  titleClassName,
}) => {
  const offeringsQuery = useMentorshipTeacherOfferingsQuery(teacherId);
  const groupLessonsQuery = useMentorshipGroupLessonsListQuery({ teacherId, limit: 3 });

  const durations = offeringsQuery.data?.enabled ? offeringsQuery.data.durations : [];
  const groupLessons = groupLessonsQuery.data?.groupLessons ?? [];
  const introVideoUrl = offeringsQuery.data?.introVideoUrl ?? null;

  if (durations.length === 0 && groupLessons.length === 0) {
    return null;
  }

  const hasBoth = durations.length > 0 && groupLessons.length > 0;

  return (
    <section id="live" className={`${styles.root} ${className ?? ""}`} aria-labelledby="live-teaching-heading">
      <h2 id="live-teaching-heading" className={titleClassName ?? styles.title}>
        Learn live with {teacherName}
      </h2>

      {introVideoUrl && (
        <div className={styles.intro}>
          <video
            className={styles.introVideo}
            src={introVideoUrl}
            controls
            preload="metadata"
            playsInline
            aria-label={`Intro video from ${teacherName}`}
          />
        </div>
      )}

      <div className={`${styles.grid} ${hasBoth ? styles.gridTwo : ""}`}>
        {durations.length > 0 && (
          <div className={`${styles.panel} ${styles.panelPrivate}`}>
            <div className={styles.panelHead}>
              <span className={styles.panelIcon} aria-hidden="true">
                <Video size={20} />
              </span>
              <div>
                <h3 className={styles.panelTitle}>1:1 video session</h3>
                <p className={styles.panelText}>Just you and {teacherName}, at a time that suits you.</p>
              </div>
            </div>

            {offeringsQuery.data?.isTrialEligible && (
              <p className={styles.trialNote}>
                <Sparkles size={14} aria-hidden="true" /> Your first session is a trial
              </p>
            )}

            <div className={styles.options}>
              {durations.map((d) => (
                <Link
                  key={d.durationMinutes}
                  to={`/live-teaching/book/${teacherId}?duration=${d.durationMinutes}`}
                  className={styles.option}
                >
                  <span className={styles.optionLength}>
                    <Clock size={15} aria-hidden="true" /> {d.durationMinutes} min
                  </span>
                  <span className={styles.optionPrice}>{formatPrice(d.price)}</span>
                </Link>
              ))}
            </div>

            <Link to={`/live-teaching/book/${teacherId}`} className={styles.cta}>
              See open times <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        )}

        {groupLessons.length > 0 && (
          <div className={`${styles.panel} ${styles.panelGroup}`}>
            <div className={styles.panelHead}>
              <span className={styles.panelIcon} aria-hidden="true">
                <Users size={20} />
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
