import React, { useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { Video, CalendarDays, Users, IndianRupee, Search, Info } from "lucide-react";
import { useMentorshipGroupLessonsListQuery } from "../helpers/useMentorship";
import { groupLessonPath } from "../helpers/groupLessonRoutes";
import { Skeleton } from "../components/Skeleton";
import { Input } from "../components/Input";
import styles from "./course.live.module.css";

const formatPrice = (price: number) => (price > 0 ? `₹${price.toLocaleString("en-IN")}` : "Free");

const formatWhen = (date: Date | string) =>
  new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(date));

const LiveCoursesPage: React.FC = () => {
  const [subject, setSubject] = useState("");
  const { data, isLoading, isError, refetch } = useMentorshipGroupLessonsListQuery({
    subject: subject.trim() || undefined,
    limit: 60,
  });
  const groupLessons = data?.groupLessons ?? [];

  return (
    <>
      <Helmet>
        <title>Live Group Classes - 1:1 Sessions &amp; Group Lessons | Testkart</title>
        <meta
          name="description"
          content="Join a live group class with a Testkart educator, or book a private 1:1 session - real-time video teaching, scheduled around your timezone."
        />
        <link rel="canonical" href="https://testkart.in/course/live" />
      </Helmet>

      <div className={`${styles.page} tk-flow`}>
      <div className={styles.pageWrapper}>
        <header className={styles.hero}>
          <span className={styles.eyebrow}>
            <Video size={14} aria-hidden="true" /> Live Classes
          </span>
          <h1 className={styles.heroTitle}>Learn live, one-on-one or in a small group</h1>
          <p className={styles.heroSubtitle}>
            Book a private 1:1 session with any educator from their profile, or join an open live group class below.
          </p>
          <div className={styles.searchRow}>
            <Search size={16} className={styles.searchIcon} aria-hidden="true" />
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Search live classes by subject..."
              className={styles.searchInput}
              aria-label="Search live group classes by subject"
            />
          </div>
          <div className={styles.tabs} role="tablist" aria-label="Course sections">
            <Link to="/course" className={styles.tabLink}>
              All Courses
            </Link>
            <span className={`${styles.tabLink} ${styles.tabLinkActive}`} role="tab" aria-selected="true">
              Live Classes
            </span>
          </div>
        </header>

        <main className={styles.main}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Open live group classes</h2>
            {groupLessons.length > 0 && <span className={styles.sectionCount}>{groupLessons.length} open</span>}
          </div>

          {isLoading ? (
            <div className={styles.grid}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className={styles.skeletonCard}>
                  <Skeleton style={{ height: "1rem", width: "60%" }} />
                  <Skeleton style={{ height: "1.25rem", width: "90%" }} />
                  <Skeleton style={{ height: "0.875rem", width: "70%" }} />
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className={styles.errorBox}>
              <p className={styles.emptyTitle}>Could not load live classes right now.</p>
              <button type="button" className={styles.retry} onClick={() => refetch()}>
                Try again
              </button>
            </div>
          ) : groupLessons.length === 0 ? (
            <div className={styles.empty}>
              <span className={styles.emptyIcon} aria-hidden="true">
                <CalendarDays size={22} />
              </span>
              <div>
                <p className={styles.emptyTitle}>No open live classes right now</p>
                <p className={styles.emptyText}>
                  Check back soon, or visit a teacher's profile to book a private 1:1 session directly.
                </p>
              </div>
            </div>
          ) : (
            <div className={styles.grid}>
              {groupLessons.map((lesson) => (
                <Link key={lesson.id} to={groupLessonPath(lesson.id)} className={styles.card}>
                  {lesson.coverImageUrl && (
                    <img src={lesson.coverImageUrl} alt="" className={styles.cardThumbnail} loading="lazy" />
                  )}
                  <div className={styles.cardTop}>
                    {lesson.subject && <span className={styles.subjectTag}>{lesson.subject}</span>}
                    <span className={`${styles.priceTag} ${lesson.pricePerLearner > 0 ? "" : styles.priceFree}`}>
                      {formatPrice(lesson.pricePerLearner)}
                    </span>
                  </div>
                  <h3 className={styles.cardTitle}>{lesson.title}</h3>
                  <div className={styles.cardTeacher}>
                    {lesson.teacherAvatarUrl ? (
                      <img src={lesson.teacherAvatarUrl} alt="" className={styles.teacherAvatar} loading="lazy" />
                    ) : (
                      <span className={styles.teacherAvatarFallback} aria-hidden="true">
                        {lesson.teacherName.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span>{lesson.teacherName}</span>
                  </div>
                  <ul className={styles.facts}>
                    <li>
                      <CalendarDays size={13} aria-hidden="true" /> {formatWhen(lesson.startTime)}
                    </li>
                    <li>
                      <Users size={13} aria-hidden="true" /> {lesson.enrolledCount}/{lesson.maxCapacity} enrolled
                    </li>
                  </ul>
                </Link>
              ))}
            </div>
          )}

          <div className={styles.infoNote}>
            <Info size={16} aria-hidden="true" />
            <p>
              Looking for a private 1:1 session instead? Visit the educator's profile page - teachers who offer 1:1
              sessions show a "Live teaching" section with their available times.
            </p>
          </div>
        </main>
      </div>
      </div>
    </>
  );
};

export default LiveCoursesPage;
