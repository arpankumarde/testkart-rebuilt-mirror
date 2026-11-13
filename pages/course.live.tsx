import React, { useDeferredValue, useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { Video, CalendarDays, Search, Info } from "lucide-react";
import { useLiveCoursesQuery } from "../helpers/useLiveCourses";
import { Skeleton } from "../components/Skeleton";
import { Input } from "../components/Input";
import { LiveCourseCard } from "../components/LiveCourseCard";
import styles from "./course.live.module.css";

const LiveCoursesPage: React.FC = () => {
  const [search, setSearch] = useState("");
  const q = useDeferredValue(search.trim());
  const { data, isLoading, isError, refetch } = useLiveCoursesQuery({ q: q || undefined, limit: 60 });
  const courses = data?.courses ?? [];

  return (
    <>
      <Helmet>
        <title>Live Courses - Live Classes with Top Educators | Testkart</title>
        <meta
          name="description"
          content="Join a live course on Testkart: a full batch of live video classes with a syllabus, a timetable and a full refund before the 3rd class."
        />
        <link rel="canonical" href="https://testkart.in/course/live" />
      </Helmet>

      <div className={`${styles.page} tk-flow`}>
      <div className={styles.pageWrapper}>
        <header className={styles.hero}>
          <span className={styles.eyebrow}>
            <Video size={14} aria-hidden="true" /> Live Courses
          </span>
          <h1 className={styles.heroTitle}>Learn live with a full batch</h1>
          <p className={styles.heroSubtitle}>
            Every live course has a syllabus, a fixed timetable of live classes and a full refund before the 3rd class.
          </p>
          <div className={styles.searchRow}>
            <Search size={16} className={styles.searchIcon} aria-hidden="true" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search live courses..."
              className={styles.searchInput}
              aria-label="Search live courses"
            />
          </div>
          <div className={styles.tabs} role="tablist" aria-label="Course sections">
            <Link to="/course" className={styles.tabLink}>
              All Courses
            </Link>
            <span className={`${styles.tabLink} ${styles.tabLinkActive}`} role="tab" aria-selected="true">
              Live Courses
            </span>
          </div>
        </header>

        <main className={styles.main}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Open for enrolment</h2>
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
              <p className={styles.emptyTitle}>Could not load live courses right now.</p>
              <button type="button" className={styles.retry} onClick={() => refetch()}>
                Try again
              </button>
            </div>
          ) : courses.length === 0 ? (
            <div className={styles.empty}>
              <span className={styles.emptyIcon} aria-hidden="true">
                <CalendarDays size={22} />
              </span>
              <div>
                <p className={styles.emptyTitle}>{q ? "No live course matches that search" : "No live courses open right now"}</p>
                <p className={styles.emptyText}>
                  Check back soon, or visit a teacher's profile to book a private 1:1 session directly.
                </p>
              </div>
            </div>
          ) : (
            <div className={styles.grid}>
              {courses.map((course) => (
                <LiveCourseCard key={course.id} course={course} />
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
