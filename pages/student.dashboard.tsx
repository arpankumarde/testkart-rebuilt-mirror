import React, { useMemo, useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { useAuth } from "../helpers/useAuth";
import { useEnrolledTestsQuery } from "../helpers/useEnrolledTestsQuery";
import { useStudentEnrolledCoursesQuery } from "../helpers/useStudentCoursesQuery";
import { useStudentEnrolledLiveTestsQuery } from "../helpers/useStudentEnrolledLiveTestsQuery";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { EnrolledTestCard } from "../components/EnrolledTestCard";
import { EnrolledCourseCard } from "../components/EnrolledCourseCard";
import { EnrolledLiveTestCard } from "../components/EnrolledLiveTestCard";
import { StudentProfileCompletionCard } from "../components/StudentProfileCompletionCard";
import { BRAND_APP_ICON } from "../helpers/brandAssets";
import {
  BookCopy,
  CheckCircle,
  BarChart3,
  ArrowRight,
  BookOpen,
  GraduationCap,
  ChevronRight,
  Radio,
  RotateCw,
  X,
} from "lucide-react";
import styles from "./student.dashboard.module.css";

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  isLoading: boolean;
}> = ({ icon, label, value, isLoading }) => (
  <div className={styles.statCard}>
    <span className={styles.statIcon} aria-hidden="true">
      {icon}
    </span>
    <span className={styles.statLabel}>{label}</span>
    {isLoading ? (
      <Skeleton className={styles.statValueSkeleton} />
    ) : (
      <span className={styles.statValue}>{value}</span>
    )}
  </div>
);

const SectionHeader: React.FC<{
  title: string;
  count?: number;
  to: string;
}> = ({ title, count, to }) => (
  <div className={styles.sectionHeader}>
    <h2 className={styles.sectionTitle}>
      {title}
      {typeof count === "number" && count > 0 && (
        <span className={styles.sectionCount}>{count}</span>
      )}
    </h2>
    <Link to={to} className={styles.viewAllLink}>
      View all <ChevronRight size={15} />
    </Link>
  </div>
);

const LoadError: React.FC<{ message: string; onRetry: () => void }> = ({
  message,
  onRetry,
}) => (
  <div className={styles.stateBlock}>
    <p className={styles.stateTitle}>{message}</p>
    <p className={styles.stateHint}>
      This is usually a connection hiccup rather than anything wrong with your account.
    </p>
    <Button variant="outline" size="sm" onClick={onRetry}>
      <RotateCw size={15} /> Try again
    </Button>
  </div>
);

const StudentDashboardPage: React.FC = () => {
  const { authState } = useAuth();
  const {
    data: enrolledData,
    isFetching: isLoadingTests,
    error: testsError,
    refetch: refetchTests,
  } = useEnrolledTestsQuery();
  const {
    data: coursesData,
    isFetching: isLoadingCourses,
    error: coursesError,
    refetch: refetchCourses,
  } = useStudentEnrolledCoursesQuery();
  const {
    data: liveTestsData,
    isFetching: isLoadingLiveTests,
    error: liveTestsError,
    refetch: refetchLiveTests,
  } = useStudentEnrolledLiveTestsQuery();

  const enrolledTests = enrolledData?.enrolledTests ?? [];
  const enrolledCourses = coursesData?.enrolledCourses ?? [];
  const enrolledLiveTests = liveTestsData?.enrolledLiveTests ?? [];

  const ongoingTests = useMemo(
    () => enrolledTests.filter((test) => test.completedItems < test.totalItems),
    [enrolledTests]
  );

  const ongoingCourses = useMemo(
    () => enrolledCourses.filter((course) => course.completionPercentage < 100),
    [enrolledCourses]
  );

  const endedLiveTests = useMemo(
    () => enrolledLiveTests.filter((lt) => lt.status === "ended"),
    [enrolledLiveTests]
  );

  const activeLiveTests = useMemo(
    () => enrolledLiveTests.filter((lt) => lt.status !== "ended"),
    [enrolledLiveTests]
  );

  const testsEnrolledCount = enrolledTests.length;
  const coursesEnrolledCount = enrolledCourses.length;
  const coursesInProgressCount = ongoingCourses.length;
  const liveTestsParticipatedCount = endedLiveTests.length;

  const testsCompletedCount = enrolledTests.reduce(
    (sum, test) => sum + test.completedItems,
    0
  );

  const [showAppBanner, setShowAppBanner] = useState(() => {
    return localStorage.getItem("testkart_app_banner_dismissed") !== "true";
  });

  const dismissAppBanner = () => {
    setShowAppBanner(false);
    localStorage.setItem("testkart_app_banner_dismissed", "true");
  };

  const averageScore = useMemo(() => {
    const testsWithScores = enrolledTests.filter((test) => test.averageScore !== null);
    if (testsWithScores.length === 0) return null;

    const totalScore = testsWithScores.reduce(
      (sum, test) => sum + (test.averageScore ?? 0),
      0
    );
    return totalScore / testsWithScores.length;
  }, [enrolledTests]);

  if (authState.type === "loading") {
    return (
      <div className={styles.page}>
        <Helmet>
          <title>Loading Dashboard... | Testkart</title>
        </Helmet>
        <div className={styles.header}>
          <Skeleton style={{ width: "280px", height: "1.8rem" }} />
        </div>
        <div className={styles.statsGrid}>
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className={styles.statCardSkeleton} />
          ))}
        </div>
        <Skeleton style={{ height: "220px", borderRadius: "var(--radius-md)" }} />
      </div>
    );
  }

  if (authState.type !== "authenticated") {
    return null;
  }

  const { user } = authState;

  const renderTestsContent = () => {
    if (isLoadingTests) {
      return (
        <div className={styles.testsGrid}>
          {Array.from({ length: 2 }).map((_, index) => (
            <Skeleton key={index} className={styles.cardSkeleton} />
          ))}
        </div>
      );
    }

    if (testsError) {
      return (
        <LoadError
          message="We could not load your test packages."
          onRetry={() => refetchTests()}
        />
      );
    }

    if (enrolledTests.length === 0) {
      return (
        <div className={styles.stateBlock}>
          <span className={styles.stateIcon} aria-hidden="true">
            <BookCopy size={22} />
          </span>
          <p className={styles.stateTitle}>No test packages yet</p>
          <p className={styles.stateHint}>
            Enrol in a package to start practising and tracking your scores.
          </p>
          <Button asChild size="sm">
            <Link to="/mock-test">
              Browse tests <ArrowRight size={15} />
            </Link>
          </Button>
        </div>
      );
    }

    if (ongoingTests.length === 0) {
      return (
        <div className={styles.stateBlock}>
          <span className={styles.stateIcon} aria-hidden="true">
            <CheckCircle size={22} />
          </span>
          <p className={styles.stateTitle}>Every package finished</p>
          <p className={styles.stateHint}>
            You have completed all {testsEnrolledCount} of your packages. Browse more to keep going.
          </p>
          <Button asChild size="sm">
            <Link to="/mock-test">
              Browse tests <ArrowRight size={15} />
            </Link>
          </Button>
        </div>
      );
    }

    // A preview only; the full list lives on /student/tests via "View all".
    return (
      <div className={styles.testsGrid}>
        {ongoingTests.slice(0, 2).map((test) => (
          <EnrolledTestCard key={test.id} enrolledTest={test} />
        ))}
      </div>
    );
  };

  const renderActiveLiveTestsContent = () => {
    if (isLoadingLiveTests) {
      return (
        <div className={styles.testsGrid}>
          <Skeleton className={styles.cardSkeleton} />
        </div>
      );
    }

    if (liveTestsError) {
      return (
        <LoadError
          message="We could not load your live tests."
          onRetry={() => refetchLiveTests()}
        />
      );
    }

    if (activeLiveTests.length === 0) return null;

    // A preview only; the full list lives on /student/live via "View all".
    return (
      <div className={styles.testsGrid}>
        {activeLiveTests.slice(0, 2).map((test) => (
          <EnrolledLiveTestCard key={test.id} test={test} />
        ))}
      </div>
    );
  };

  const renderCoursesContent = () => {
    if (isLoadingCourses) {
      return (
        <div className={styles.coursesGrid}>
          {Array.from({ length: 2 }).map((_, index) => (
            <Skeleton key={index} className={styles.cardSkeleton} />
          ))}
        </div>
      );
    }

    if (coursesError) {
      return (
        <LoadError
          message="We could not load your courses."
          onRetry={() => refetchCourses()}
        />
      );
    }

    if (enrolledCourses.length === 0) {
      return (
        <div className={styles.stateBlock}>
          <span className={styles.stateIcon} aria-hidden="true">
            <BookOpen size={22} />
          </span>
          <p className={styles.stateTitle}>No courses yet</p>
          <p className={styles.stateHint}>
            Enrol in a course to follow a structured syllabus alongside your tests.
          </p>
          <Button asChild size="sm">
            <Link to="/course">
              Browse courses <ArrowRight size={15} />
            </Link>
          </Button>
        </div>
      );
    }

    if (ongoingCourses.length === 0) {
      return (
        <div className={styles.stateBlock}>
          <span className={styles.stateIcon} aria-hidden="true">
            <CheckCircle size={22} />
          </span>
          <p className={styles.stateTitle}>Every course finished</p>
          <p className={styles.stateHint}>
            You have completed all {coursesEnrolledCount} of your courses. Browse more to keep going.
          </p>
          <Button asChild size="sm">
            <Link to="/course">
              Browse courses <ArrowRight size={15} />
            </Link>
          </Button>
        </div>
      );
    }

    // A preview only; the full list lives on /student/courses via "View all".
    // Four, not two: these are narrow cards, so two left most of the row empty.
    return (
      <div className={styles.coursesGrid}>
        {ongoingCourses.slice(0, 4).map((course) => (
          <EnrolledCourseCard key={course.id} course={course} />
        ))}
      </div>
    );
  };

  const firstName = user.displayName?.split(" ")[0] || user.displayName;

  return (
    <div className={styles.page}>
      <Helmet>
        <title>Student Dashboard | Testkart</title>
        <meta
          name="description"
          content="Manage your enrolled tests and track your progress on Testkart."
        />
      </Helmet>

      <header className={styles.header}>
        <h1 className={styles.title}>Welcome back, {firstName}</h1>
        <div className={styles.headerActions}>
          <Button asChild variant="outline" size="sm">
            <Link to="/mock-test">Browse tests</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/student/tests">Continue practising</Link>
          </Button>
        </div>
      </header>

      <StudentProfileCompletionCard />

      <section className={styles.statsGrid} aria-label="Your activity">
        <StatCard
          icon={<BookCopy size={16} />}
          label="Tests enrolled"
          value={String(testsEnrolledCount)}
          isLoading={isLoadingTests}
        />
        <StatCard
          icon={<CheckCircle size={16} />}
          label="Tests completed"
          value={String(testsCompletedCount)}
          isLoading={isLoadingTests}
        />
        <StatCard
          icon={<BarChart3 size={16} />}
          label="Average score"
          value={averageScore !== null ? `${averageScore.toFixed(1)}%` : "-"}
          isLoading={isLoadingTests}
        />
        <StatCard
          icon={<Radio size={16} />}
          label="Live tests taken"
          value={String(liveTestsParticipatedCount)}
          isLoading={isLoadingLiveTests}
        />
        <StatCard
          icon={<BookOpen size={16} />}
          label="Courses enrolled"
          value={String(coursesEnrolledCount)}
          isLoading={isLoadingCourses}
        />
        <StatCard
          icon={<GraduationCap size={16} />}
          label="Courses in progress"
          value={String(coursesInProgressCount)}
          isLoading={isLoadingCourses}
        />
      </section>

      {activeLiveTests.length > 0 && (
        <section className={styles.panel}>
          <SectionHeader
            title="Active and upcoming live tests"
            count={activeLiveTests.length}
            to="/student/live"
          />
          {renderActiveLiveTestsContent()}
        </section>
      )}

      <section className={styles.panel}>
        <SectionHeader
          title="Ongoing mock tests"
          count={ongoingTests.length}
          to="/student/tests"
        />
        {renderTestsContent()}
      </section>

      <section className={styles.panel}>
        <SectionHeader
          title="Ongoing courses"
          count={ongoingCourses.length}
          to="/student/courses"
        />
        {renderCoursesContent()}
      </section>

      {showAppBanner && (
        <section className={styles.appBanner}>
          <img src={BRAND_APP_ICON} alt="" className={styles.appBannerLogo} />
          <div className={styles.appBannerContent}>
            <h3 className={styles.appBannerTitle}>Testkart on Android</h3>
            <p className={styles.appBannerDescription}>
              Take your tests, courses and notes with you on your phone.
            </p>
          </div>
          <a
            href="https://play.google.com/store/apps/details?id=com.testkart.mocktest.courses.studynotes"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.playBadgeLink}
          >
            <span className={styles.playBadgeCrop}>
              <img
                src="https://play.google.com/intl/en_us/badges/images/generic/en_badge_web_generic.png"
                alt="Get it on Google Play"
                className={styles.playBadgeImgCropped}
              />
            </span>
          </a>
          <a
            href="https://indusapp.store/pbmrru87"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.playBadgeLink}
          >
            <img
              src="https://docstore.indusappstore.com/public/external/developerdashboard-static/badge-black-background-english.png"
              alt="Get it on Indus Appstore"
              className={`${styles.playBadgeImg} ${styles.indusBadgeImgLight}`}
            />
            <img
              src="https://docstore.indusappstore.com/public/external/developerdashboard-static/badge-white-background-english.png"
              alt="Get it on Indus Appstore"
              className={`${styles.playBadgeImg} ${styles.indusBadgeImgDark}`}
            />
          </a>
          <button
            type="button"
            className={styles.appBannerClose}
            onClick={dismissAppBanner}
            aria-label="Dismiss app banner"
          >
            <X size={18} />
          </button>
        </section>
      )}
    </div>
  );
};

export default StudentDashboardPage;
