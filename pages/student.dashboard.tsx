import React, { useMemo, useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { useAuth } from "../helpers/useAuth";
import { useEnrolledTestsQuery } from "../helpers/useEnrolledTestsQuery";
import { useStudentEnrolledCoursesQuery } from "../helpers/useStudentCoursesQuery";
import { useStudentEnrolledLiveTestsQuery } from "../helpers/useStudentEnrolledLiveTestsQuery";
import { useStudentPurchasesQuery } from "../helpers/useShopQuery";
import { useStudentTcoins } from "../helpers/useTcoins";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { EnrolledTestCard } from "../components/EnrolledTestCard";
import { EnrolledCourseCard } from "../components/EnrolledCourseCard";
import { EnrolledLiveTestCard } from "../components/EnrolledLiveTestCard";
import { StudentProductCard } from "../components/StudentProductCard";
import { StudentProfileCompletionCard } from "../components/StudentProfileCompletionCard";
import { Doodle } from "../components/AppLandingArt";
import { BRAND_APP_ICON } from "../helpers/brandAssets";
import { PLAY_BADGE_IMAGE } from "../helpers/appLandingContent";
import {
  BookCopy,
  CheckCircle,
  BarChart3,
  ArrowRight,
  BookOpen,
  ChevronRight,
  Coins,
  FileText,
  Radio,
  RotateCw,
  X,
} from "lucide-react";
import styles from "./student.dashboard.module.css";

type Tone = "lavender" | "mint" | "butter" | "blue" | "peach";

/* A figure tile. With `to` the whole tile is a link and shows a chevron. */
const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  isLoading: boolean;
  tone: Tone;
  to?: string;
}> = ({ icon, label, value, isLoading, tone, to }) => {
  const body = (
    <>
      <span className={styles.statIcon} aria-hidden="true">
        {icon}
      </span>
      {isLoading ? (
        <Skeleton className={styles.statValueSkeleton} />
      ) : (
        <span className={styles.statValue}>{value}</span>
      )}
      <span className={styles.statLabel}>{label}</span>
      {to && <ChevronRight size={18} className={styles.statChevron} aria-hidden="true" />}
    </>
  );

  return to ? (
    <Link to={to} className={`${styles.statCard} ${styles.statLink}`} data-tone={tone}>
      {body}
    </Link>
  ) : (
    <div className={styles.statCard} data-tone={tone}>
      {body}
    </div>
  );
};

const SectionHeader: React.FC<{
  title: string;
  to: string;
  icon: React.ReactNode;
}> = ({ title, to, icon }) => (
  <div className={styles.sectionHeader}>
    <h2 className={styles.sectionTitle}>
      <span className={styles.sectionIcon} aria-hidden="true">
        {icon}
      </span>
      {title}
    </h2>
    <Link to={to} className={styles.viewAllLink}>
      View all <ChevronRight size={15} />
    </Link>
  </div>
);

/* One compact row for every empty and error state: what is missing, and the
   one thing to do about it. */
const StateRow: React.FC<{
  icon?: React.ReactNode;
  message: string;
  children: React.ReactNode;
}> = ({ icon, message, children }) => (
  <div className={styles.stateBlock}>
    {icon && (
      <span className={styles.stateIcon} aria-hidden="true">
        {icon}
      </span>
    )}
    <p className={styles.stateTitle}>{message}</p>
    {children}
  </div>
);

const BrowseButton: React.FC<{ to: string; label: string }> = ({ to, label }) => (
  <Button asChild variant="outline" size="sm">
    <Link to={to}>
      {label} <ArrowRight size={15} />
    </Link>
  </Button>
);

const RetryButton: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
  <Button variant="outline" size="sm" onClick={onRetry}>
    <RotateCw size={15} /> Try again
  </Button>
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
  const { data: liveTestsData } = useStudentEnrolledLiveTestsQuery();
  // Default params, so this shares its cache with /student/shop.
  const {
    data: notesData,
    isFetching: isLoadingNotes,
    error: notesError,
    refetch: refetchNotes,
  } = useStudentPurchasesQuery();
  // Hidden while Tcoins are switched off.
  const { data: tcoins } = useStudentTcoins();

  const enrolledTests = enrolledData?.enrolledTests ?? [];
  const enrolledCourses = coursesData?.enrolledCourses ?? [];
  const enrolledLiveTests = liveTestsData?.enrolledLiveTests ?? [];
  const purchasedNotes = notesData?.purchases ?? [];

  const ongoingTests = useMemo(
    () => enrolledTests.filter((test) => test.completedItems < test.totalItems),
    [enrolledTests]
  );

  const ongoingCourses = useMemo(
    () => enrolledCourses.filter((course) => course.completionPercentage < 100),
    [enrolledCourses]
  );

  const activeLiveTests = useMemo(
    () => enrolledLiveTests.filter((lt) => lt.status !== "ended"),
    [enrolledLiveTests]
  );

  // Individual tests finished, across every series.
  const testsDoneCount = enrolledTests.reduce((sum, test) => sum + test.completedItems, 0);

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
        <div className={styles.hero}>
          <Skeleton style={{ width: "280px", height: "2.5rem" }} />
        </div>
        <div className={styles.statsGrid}>
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className={styles.statCardSkeleton} />
          ))}
        </div>
        <Skeleton style={{ height: "220px", borderRadius: "var(--radius-lg)" }} />
      </div>
    );
  }

  if (authState.type !== "authenticated") {
    return null;
  }

  const { user } = authState;

  const renderTestsContent = () => {
    if (isLoadingTests && !enrolledData) {
      return (
        <div className={styles.cardGrid}>
          {Array.from({ length: 2 }).map((_, index) => (
            <Skeleton key={index} className={styles.cardSkeleton} />
          ))}
        </div>
      );
    }

    if (testsError) {
      return (
        <StateRow message="Could not load your tests.">
          <RetryButton onRetry={() => refetchTests()} />
        </StateRow>
      );
    }

    if (enrolledTests.length === 0) {
      return (
        <StateRow icon={<BookCopy size={20} />} message="No test series yet">
          <BrowseButton to="/mock-test" label="Browse tests" />
        </StateRow>
      );
    }

    if (ongoingTests.length === 0) {
      return (
        <StateRow icon={<CheckCircle size={20} />} message="You have finished all your tests">
          <BrowseButton to="/mock-test" label="Browse tests" />
        </StateRow>
      );
    }

    // A preview only; the full list lives on /student/tests via "View all".
    return (
      <div className={styles.cardGrid}>
        {ongoingTests.slice(0, 2).map((test) => (
          <EnrolledTestCard key={test.id} enrolledTest={test} />
        ))}
      </div>
    );
  };

  const renderCoursesContent = () => {
    if (isLoadingCourses && !coursesData) {
      return (
        <div className={styles.cardGrid}>
          {Array.from({ length: 2 }).map((_, index) => (
            <Skeleton key={index} className={styles.cardSkeleton} />
          ))}
        </div>
      );
    }

    if (coursesError) {
      return (
        <StateRow message="Could not load your courses.">
          <RetryButton onRetry={() => refetchCourses()} />
        </StateRow>
      );
    }

    if (enrolledCourses.length === 0) {
      return (
        <StateRow icon={<BookOpen size={20} />} message="No courses yet">
          <BrowseButton to="/course" label="Browse courses" />
        </StateRow>
      );
    }

    if (ongoingCourses.length === 0) {
      return (
        <StateRow icon={<CheckCircle size={20} />} message="You have finished all your courses">
          <BrowseButton to="/course" label="Browse courses" />
        </StateRow>
      );
    }

    // A preview only; the full list lives on /student/courses via "View all".
    // Four, not two: these are narrow cards, so two left most of the row empty.
    return (
      <div className={styles.cardGrid}>
        {ongoingCourses.slice(0, 4).map((course) => (
          <EnrolledCourseCard key={course.id} course={course} />
        ))}
      </div>
    );
  };

  const renderNotesContent = () => {
    if (isLoadingNotes && !notesData) {
      return (
        <div className={styles.cardGrid}>
          {Array.from({ length: 2 }).map((_, index) => (
            <Skeleton key={index} className={styles.cardSkeleton} />
          ))}
        </div>
      );
    }

    if (notesError) {
      return (
        <StateRow message="Could not load your study notes.">
          <RetryButton onRetry={() => refetchNotes()} />
        </StateRow>
      );
    }

    if (purchasedNotes.length === 0) {
      return (
        <StateRow icon={<FileText size={20} />} message="No study notes yet">
          <BrowseButton to="/study-notes" label="Browse study notes" />
        </StateRow>
      );
    }

    // A preview of the latest purchases; the full list lives on /student/shop via "View all".
    return (
      <div className={styles.cardGrid}>
        {purchasedNotes.slice(0, 4).map((purchase) => (
          <StudentProductCard key={purchase.purchaseId} purchase={purchase} />
        ))}
      </div>
    );
  };

  const firstName = user.displayName?.split(" ")[0] || user.displayName;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  // The series the main button resumes. With nothing in progress the button
  // sends the student to browse instead.
  const nextSeries = ongoingTests[0];
  const nothingToContinue = !!enrolledData && !testsError && ongoingTests.length === 0;

  return (
    <div className={styles.page}>
      <Helmet>
        <title>Student Dashboard | Testkart</title>
        <meta
          name="description"
          content="Manage your enrolled tests and track your progress on Testkart."
        />
      </Helmet>

      <header className={styles.hero}>
        <p className={styles.scribble}>{greeting}!</p>
        <h1 className={styles.title}>
          Welcome back,{" "}
          <span className={styles.marked}>
            {firstName}
            <Doodle kind="swoosh" className={styles.markSwoosh} />
          </span>
        </h1>
        {nextSeries && <p className={styles.heroLead}>Next up: {nextSeries.title}</p>}
        <div className={styles.headerActions}>
          {nothingToContinue ? (
            <Button asChild>
              <Link to="/mock-test">
                Browse tests <ArrowRight size={16} />
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild>
                <Link to={nextSeries ? `/student/tests/${nextSeries.id}` : "/student/tests"}>
                  Continue practising <ArrowRight size={16} />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/mock-test">Browse tests</Link>
              </Button>
            </>
          )}
        </div>
      </header>

      <StudentProfileCompletionCard />

      <section className={styles.statsGrid} aria-label="Your progress">
        {tcoins?.enabled && (
          <StatCard
            icon={<Coins size={18} />}
            label="Tcoins"
            value={tcoins.balance.toLocaleString("en-IN")}
            isLoading={false}
            tone="peach"
            to="/student/wallet?tab=tcoins"
          />
        )}
        <StatCard
          icon={<BookCopy size={18} />}
          label="Test series"
          value={String(enrolledTests.length)}
          isLoading={isLoadingTests && !enrolledData}
          tone="lavender"
        />
        <StatCard
          icon={<CheckCircle size={18} />}
          label="Tests done"
          value={String(testsDoneCount)}
          isLoading={isLoadingTests && !enrolledData}
          tone="mint"
        />
        <StatCard
          icon={<BarChart3 size={18} />}
          label="Average score"
          value={averageScore !== null ? `${averageScore.toFixed(1)}%` : "-"}
          isLoading={isLoadingTests && !enrolledData}
          tone="butter"
        />
        <StatCard
          icon={<BookOpen size={18} />}
          label="Courses"
          value={String(enrolledCourses.length)}
          isLoading={isLoadingCourses && !coursesData}
          tone="blue"
        />
      </section>

      {/* A preview only; the full list lives on /student/live via "View all". */}
      {activeLiveTests.length > 0 && (
        <section className={styles.panel} data-tone="peach">
          <SectionHeader title="Live tests" to="/student/live" icon={<Radio size={18} />} />
          <div className={styles.cardGrid}>
            {activeLiveTests.slice(0, 2).map((test) => (
              <EnrolledLiveTestCard key={test.id} test={test} />
            ))}
          </div>
        </section>
      )}

      <section className={styles.panel} data-tone="lavender">
        <SectionHeader title="Tests in progress" to="/student/tests" icon={<BookCopy size={18} />} />
        {renderTestsContent()}
      </section>

      <section className={styles.panel} data-tone="mint">
        <SectionHeader title="Courses in progress" to="/student/courses" icon={<BookOpen size={18} />} />
        {renderCoursesContent()}
      </section>

      <section className={styles.panel} data-tone="butter">
        <SectionHeader title="Study notes" to="/student/shop" icon={<FileText size={18} />} />
        {renderNotesContent()}
      </section>

      {showAppBanner && (
        <section className={styles.appBanner}>
          <img src={BRAND_APP_ICON} alt="" className={styles.appBannerLogo} />
          <div className={styles.appBannerContent}>
            <h3 className={styles.appBannerTitle}>Get the Testkart app</h3>
            <p className={styles.appBannerDescription}>
              Tests, courses and notes on your phone.
            </p>
          </div>
          <a
            href="https://play.google.com/store/apps/details?id=com.testkart.mocktest.courses.studynotes"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.playBadgeLink}
          >
            <img
              src={PLAY_BADGE_IMAGE}
              alt="Get it on Google Play"
              width={270}
              height={81}
              className={styles.playBadgeImg}
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
