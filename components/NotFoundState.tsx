import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  Compass,
  FileQuestion,
  FileText,
  GraduationCap,
  Home,
  LifeBuoy,
  Newspaper,
  Package,
  RefreshCw,
  Sparkles,
  Trophy,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { SEOHead } from "./SEOHead";
import { PlayfulButton } from "./PlayfulButton";
import { Skeleton } from "./Skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "./Avatar";
import { VerifiedBadge } from "./VerifiedBadge";
import { CourseCard } from "./CourseCard";
import { TestCard } from "./TestCard";
import { LiveTestCard } from "./LiveTestCard";
import { ProductCard } from "./ProductCard";
import { PublicBundleCard } from "./PublicBundleCard";
import { BlogPostCard } from "./BlogPostCard";
import { usePublicCoursesQuery } from "../helpers/useStudentCoursesQuery";
import { useTestsQuery } from "../helpers/useTestsQuery";
import { useLiveTestsQuery } from "../helpers/useLiveTestsQuery";
import { useShopProductsQuery } from "../helpers/useShopQuery";
import { useBundlesQuery } from "../helpers/useBundlesQuery";
import { useBlogPostsQuery } from "../helpers/useBlogQuery";
import { useHomepageData } from "../helpers/useHomepageData";
import { getPopularExamsWithTests } from "../endpoints/exams/popular-with-tests_GET.schema";
import styles from "./NotFoundState.module.css";

export type NotFoundKind =
  | "course"
  | "test"
  | "exam"
  | "live"
  | "notes"
  | "bundle"
  | "blog"
  | "help"
  | "teacher"
  | "page";

type Tone = "peach" | "lavender" | "sage" | "blue" | "mint";

interface LinkAction {
  label: string;
  to: string;
  icon: LucideIcon;
}

interface KindConfig {
  label: string;
  title: string;
  message: string;
  icon: LucideIcon;
  tone: Tone;
  primary: LinkAction;
  secondary: LinkAction;
}

const HOME: LinkAction = { label: "Go to homepage", to: "/", icon: Home };

const KINDS: Record<NotFoundKind, KindConfig> = {
  course: {
    label: "Course",
    title: "Course not found",
    message:
      "This course may have been removed, unpublished or moved to a new link. Here are some popular courses you can start today.",
    icon: GraduationCap,
    tone: "peach",
    primary: { label: "Browse all courses", to: "/course", icon: GraduationCap },
    secondary: HOME,
  },
  test: {
    label: "Test series",
    title: "Test series not found",
    message:
      "This test series is no longer available or its link has changed. Pick your exam or try one of the popular series below.",
    icon: FileText,
    tone: "blue",
    primary: { label: "Browse test series", to: "/mock-test", icon: FileText },
    secondary: { label: "Explore exams", to: "/exams", icon: Compass },
  },
  exam: {
    label: "Exam",
    title: "Exam not found",
    message:
      "We could not find an exam at this address. Choose one of the popular exams below or browse the full list.",
    icon: Compass,
    tone: "sage",
    primary: { label: "Browse all exams", to: "/exams", icon: Compass },
    secondary: { label: "Browse test series", to: "/mock-test", icon: FileText },
  },
  live: {
    label: "Live test",
    title: "Live test not found",
    message:
      "This live competition has been removed or the link is incorrect. Join one that is running now or coming up next.",
    icon: Trophy,
    tone: "lavender",
    primary: { label: "See all live tests", to: "/mock-test/live", icon: Trophy },
    secondary: { label: "Browse test series", to: "/mock-test", icon: FileText },
  },
  notes: {
    label: "Study notes",
    title: "Study notes not found",
    message:
      "These notes are no longer on sale or the link has changed. Explore popular notes from our educators instead.",
    icon: BookOpen,
    tone: "mint",
    primary: { label: "Explore study notes", to: "/study-notes", icon: BookOpen },
    secondary: { label: "Browse bundles", to: "/bundles", icon: Package },
  },
  bundle: {
    label: "Bundle",
    title: "Bundle not found",
    message:
      "This bundle may have been unpublished or its link has changed. Here are other popular bundles worth a look.",
    icon: Package,
    tone: "peach",
    primary: { label: "Browse bundles", to: "/bundles", icon: Package },
    secondary: { label: "Explore study notes", to: "/study-notes", icon: BookOpen },
  },
  blog: {
    label: "Article",
    title: "Article not found",
    message:
      "This article may have been removed or renamed. Catch up on our latest posts while you are here.",
    icon: Newspaper,
    tone: "blue",
    primary: { label: "Read all articles", to: "/blog", icon: Newspaper },
    secondary: HOME,
  },
  help: {
    label: "Help article",
    title: "Help article not found",
    message:
      "This help article may have been moved or retired. Search the help center or reach out and we will sort it out.",
    icon: LifeBuoy,
    tone: "sage",
    primary: { label: "Visit help center", to: "/help", icon: LifeBuoy },
    secondary: { label: "Contact support", to: "/contact", icon: UserRound },
  },
  teacher: {
    label: "Educator",
    title: "Educator not found",
    message:
      "This profile is no longer active or the link is incorrect. Meet some of the top educators on Testkart, or browse their courses.",
    icon: UserRound,
    tone: "lavender",
    primary: { label: "Browse courses", to: "/course", icon: GraduationCap },
    secondary: { label: "Browse test series", to: "/mock-test", icon: FileText },
  },
  page: {
    label: "Page",
    title: "Out of syllabus!",
    message:
      "This page has been moved, deleted or never existed. Let's get you back to preparing.",
    icon: FileQuestion,
    tone: "peach",
    primary: HOME,
    secondary: { label: "Browse test series", to: "/mock-test", icon: FileText },
  },
};

const QUICK_LINKS: (LinkAction & { hint: string; tone: Tone })[] = [
  { label: "Mock tests", hint: "Practise with test series", to: "/mock-test", icon: FileText, tone: "blue" },
  { label: "Live tests", hint: "Compete in real time", to: "/mock-test/live", icon: Trophy, tone: "lavender" },
  { label: "Courses", hint: "Learn from educators", to: "/course", icon: GraduationCap, tone: "peach" },
  { label: "Study notes", hint: "Notes and PDFs", to: "/study-notes", icon: BookOpen, tone: "mint" },
  { label: "Exams", hint: "Find your exam", to: "/exams", icon: Compass, tone: "sage" },
  { label: "Blog", hint: "Tips and updates", to: "/blog", icon: Newspaper, tone: "blue" },
];

interface NotFoundStateProps {
  kind: NotFoundKind;
}

/**
 * The not-found state for a missing, deleted or unpublished item: what went
 * missing, a way back, and live recommendations of the same kind. Pages render
 * it in place of their content; the matching prefetch returns the 404 status.
 */
export const NotFoundState: React.FC<NotFoundStateProps> = ({ kind }) => {
  const config = KINDS[kind];
  const { pathname } = useLocation();
  const Icon = config.icon;
  const PrimaryIcon = config.primary.icon;
  const SecondaryIcon = config.secondary.icon;
  const seoTitle = kind === "page" ? "404 - Page Not Found" : config.title;

  return (
    <div className={styles.page}>
      <SEOHead title={seoTitle} description={config.message} noIndex />

      <section className={styles.hero} aria-labelledby="not-found-title">
        <div className={styles.iconTile} data-tone={config.tone} aria-hidden="true">
          <Icon />
          <span className={styles.codeTag}>404</span>
        </div>

        <div className={styles.heroBody}>
          <span className={styles.chip}>{kind === "page" ? "Error 404" : `${config.label} unavailable`}</span>
          <h1 id="not-found-title" className={styles.title}>
            {config.title}
          </h1>
          <p className={styles.message}>{config.message}</p>
          {pathname !== "/" && (
            <p className={styles.path}>
              <span className={styles.pathLabel}>You tried</span>
              <code className={styles.pathValue}>{pathname}</code>
            </p>
          )}

          <div className={styles.actions}>
            <PlayfulButton asChild tone="primary" size="lg" className={styles.ctaPrimary}>
              <Link to={config.primary.to}>
                <PrimaryIcon aria-hidden="true" />
                {config.primary.label}
              </Link>
            </PlayfulButton>
            <PlayfulButton asChild tone="soft" size="lg" className={styles.ctaSoft}>
              <Link to={config.secondary.to}>
                <SecondaryIcon aria-hidden="true" />
                {config.secondary.label}
              </Link>
            </PlayfulButton>
          </div>
        </div>
      </section>

      <Recommendations kind={kind} />
    </div>
  );
};

const Recommendations: React.FC<{ kind: NotFoundKind }> = ({ kind }) => {
  switch (kind) {
    case "course":
      return <CourseRecs />;
    case "test":
      return (
        <>
          <ExamChips />
          <TestRecs />
        </>
      );
    case "exam":
      return (
        <>
          <ExamChips />
          <TestRecs />
        </>
      );
    case "live":
      return <LiveRecs />;
    case "notes":
      return <NotesRecs />;
    case "bundle":
      return <BundleRecs />;
    case "blog":
      return <PostRecs type="blog" />;
    case "help":
      return <PostRecs type="knowledge_base" />;
    case "teacher":
      return <TeacherRecs />;
    case "page":
      return <QuickLinks />;
  }
};

interface RecsSectionProps {
  id: string;
  title: string;
  icon: LucideIcon;
  viewAll: { label: string; to: string };
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
  onRetry: () => void;
  emptyText: string;
  skeletonCount?: number;
  layout?: "cards" | "compact";
  children: React.ReactNode;
}

const RecsSection: React.FC<RecsSectionProps> = ({
  id,
  title,
  icon: Icon,
  viewAll,
  isLoading,
  isError,
  isEmpty,
  onRetry,
  emptyText,
  skeletonCount = 4,
  layout = "cards",
  children,
}) => {
  const gridClass = layout === "compact" ? styles.compactGrid : styles.cardGrid;

  let body: React.ReactNode;
  if (isLoading) {
    body = (
      <div className={gridClass} aria-busy="true">
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <Skeleton key={i} className={layout === "compact" ? styles.skeletonCompact : styles.skeletonCard} />
        ))}
      </div>
    );
  } else if (isError) {
    body = (
      <div className={styles.notice} role="status">
        <p>We could not load suggestions right now.</p>
        <PlayfulButton tone="soft" size="sm" onClick={onRetry} className={styles.ctaSoft}>
          <RefreshCw aria-hidden="true" />
          Try again
        </PlayfulButton>
      </div>
    );
  } else if (isEmpty) {
    body = (
      <div className={styles.notice} role="status">
        <p>{emptyText}</p>
        <Link to={viewAll.to} className={styles.noticeLink}>
          {viewAll.label} <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    );
  } else {
    body = <div className={gridClass}>{children}</div>;
  }

  return (
    <section className={styles.recs} aria-labelledby={id}>
      <div className={styles.recsHead}>
        <h2 id={id} className={styles.recsTitle}>
          <span className={styles.recsIcon} aria-hidden="true">
            <Icon />
          </span>
          {title}
        </h2>
        {!isEmpty && (
          <Link to={viewAll.to} className={styles.viewAll}>
            {viewAll.label} <ArrowRight size={16} aria-hidden="true" />
          </Link>
        )}
      </div>
      {body}
    </section>
  );
};

const CourseRecs: React.FC = () => {
  const { data, isFetching, isError, refetch } = usePublicCoursesQuery({ sortBy: "popular", limit: "4" });
  const courses = data?.courses ?? [];
  return (
    <RecsSection
      id="not-found-courses"
      title="Popular courses"
      icon={Sparkles}
      viewAll={{ label: "All courses", to: "/course" }}
      isLoading={isFetching && !data}
      isError={isError && !data}
      isEmpty={!!data && courses.length === 0}
      onRetry={() => refetch()}
      emptyText="No courses are on sale right now."
    >
      {courses.map((course) => (
        <CourseCard key={course.id} course={course} />
      ))}
    </RecsSection>
  );
};

const TestRecs: React.FC = () => {
  const { data, isFetching, isError, refetch } = useTestsQuery({ sortBy: "popular", limit: "4" });
  const tests = data?.tests ?? [];
  return (
    <RecsSection
      id="not-found-tests"
      title="Popular test series"
      icon={Sparkles}
      viewAll={{ label: "All test series", to: "/mock-test" }}
      isLoading={isFetching && !data}
      isError={isError && !data}
      isEmpty={!!data && tests.length === 0}
      onRetry={() => refetch()}
      emptyText="No test series are on sale right now."
    >
      {tests.map((test) => (
        <TestCard key={test.id} test={test} />
      ))}
    </RecsSection>
  );
};

const LiveRecs: React.FC = () => {
  const live = useLiveTestsQuery({ status: "live", limit: 4 });
  const upcoming = useLiveTestsQuery({ status: "upcoming", limit: 4 });
  const seen = new Set<number>();
  const tests = [...(live.data?.tests ?? []), ...(upcoming.data?.tests ?? [])]
    .filter((test) => (seen.has(test.id) ? false : (seen.add(test.id), true)))
    .slice(0, 4);
  const isLoading = (live.isFetching && !live.data) || (upcoming.isFetching && !upcoming.data);
  const isError = (live.isError || upcoming.isError) && tests.length === 0;

  return (
    <RecsSection
      id="not-found-live"
      title="Live now and coming up"
      icon={CalendarClock}
      viewAll={{ label: "All live tests", to: "/mock-test/live" }}
      isLoading={isLoading}
      isError={isError}
      isEmpty={!isLoading && !isError && tests.length === 0}
      onRetry={() => {
        live.refetch();
        upcoming.refetch();
      }}
      emptyText="No live tests are running or scheduled right now."
    >
      {tests.map((test) => (
        <LiveTestCard key={test.id} liveTest={test} />
      ))}
    </RecsSection>
  );
};

const NotesRecs: React.FC = () => {
  const { data, isFetching, isError, refetch } = useShopProductsQuery({ sort: "popular", limit: 4, page: 1 });
  const products = data?.products ?? [];
  return (
    <RecsSection
      id="not-found-notes"
      title="Popular study notes"
      icon={Sparkles}
      viewAll={{ label: "All study notes", to: "/study-notes" }}
      isLoading={isFetching && !data}
      isError={isError && !data}
      isEmpty={!!data && products.length === 0}
      onRetry={() => refetch()}
      emptyText="No study notes are on sale right now."
    >
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </RecsSection>
  );
};

const BundleRecs: React.FC = () => {
  const { data, isFetching, isError, refetch } = useBundlesQuery({ sort: "popular", limit: 3 });
  const bundles = data?.bundles ?? [];
  return (
    <RecsSection
      id="not-found-bundles"
      title="Popular bundles"
      icon={Sparkles}
      viewAll={{ label: "All bundles", to: "/bundles" }}
      isLoading={isFetching && !data}
      isError={isError && !data}
      isEmpty={!!data && bundles.length === 0}
      onRetry={() => refetch()}
      emptyText="No bundles are on sale right now."
      skeletonCount={3}
    >
      {bundles.map((bundle) => (
        <PublicBundleCard key={bundle.id} bundle={bundle} />
      ))}
    </RecsSection>
  );
};

const PostRecs: React.FC<{ type: "blog" | "knowledge_base" }> = ({ type }) => {
  const isHelp = type === "knowledge_base";
  const { data, isFetching, isError, refetch } = useBlogPostsQuery({ type, limit: 3 });
  const posts = data?.posts ?? [];
  return (
    <RecsSection
      id="not-found-posts"
      title={isHelp ? "Helpful articles" : "Recent articles"}
      icon={Newspaper}
      viewAll={isHelp ? { label: "Help center", to: "/help" } : { label: "All articles", to: "/blog" }}
      isLoading={isFetching && !data}
      isError={isError && !data}
      isEmpty={!!data && posts.length === 0}
      onRetry={() => refetch()}
      emptyText={isHelp ? "No help articles are published yet." : "No articles are published yet."}
      skeletonCount={3}
    >
      {posts.map((post) => (
        <BlogPostCard key={post.id} post={post} prefix={isHelp ? "/help" : "/blog"} />
      ))}
    </RecsSection>
  );
};

const TEACHER_LIMIT = 4;

const plural = (count: number, one: string, many: string) =>
  `${count.toLocaleString("en-IN")} ${count === 1 ? one : many}`;

const TeacherRecs: React.FC = () => {
  const { data, isFetching, isError, refetch } = useHomepageData();
  const teachers = (data?.popularTeachers ?? [])
    .filter((t) => t.testCount + t.courseCount + t.productCount > 0)
    .slice(0, TEACHER_LIMIT);

  return (
    <RecsSection
      id="not-found-teachers"
      title="Top educators on Testkart"
      icon={UserRound}
      viewAll={{ label: "All courses", to: "/course" }}
      isLoading={isFetching && !data}
      isError={isError && !data}
      isEmpty={!!data && teachers.length === 0}
      onRetry={() => refetch()}
      emptyText="No educator profiles to suggest right now."
      layout="compact"
    >
      {teachers.map((teacher) => {
        const name = teacher.displayName.trim();
        const catalog = [
          teacher.testCount > 0 ? plural(teacher.testCount, "test series", "test series") : null,
          teacher.courseCount > 0 ? plural(teacher.courseCount, "course", "courses") : null,
          teacher.productCount > 0 ? plural(teacher.productCount, "study note", "study notes") : null,
        ]
          .filter(Boolean)
          .join(" · ");
        return (
          <Link key={teacher.id} to={`/expert/${teacher.slug}`} className={styles.teacherCard}>
            <Avatar className={styles.teacherAvatar}>
              {teacher.avatarUrl && <AvatarImage src={teacher.avatarUrl} alt="" />}
              <AvatarFallback className={styles.teacherFallback}>{name.substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <span className={styles.teacherBody}>
              <span className={styles.teacherName}>
                <span className={styles.teacherNameText}>{name}</span>
                <VerifiedBadge isVerified={teacher.isVerified} size="sm" />
              </span>
              {catalog && <span className={styles.teacherMeta}>{catalog}</span>}
            </span>
            <ArrowRight size={18} className={styles.teacherArrow} aria-hidden="true" />
          </Link>
        );
      })}
    </RecsSection>
  );
};

const EXAM_CHIP_LIMIT = 8;

const ExamChips: React.FC = () => {
  // Same key as ExamFocusPicker, so the two share one cached list.
  const { data, isFetching, isError, refetch } = useQuery({
    queryKey: ["exams", "popular-with-tests"],
    queryFn: () => getPopularExamsWithTests(),
    staleTime: 10 * 60 * 1000,
  });
  const exams = (data?.exams ?? []).slice(0, EXAM_CHIP_LIMIT);

  return (
    <RecsSection
      id="not-found-exams"
      title="Popular exams"
      icon={Compass}
      viewAll={{ label: "All exams", to: "/exams" }}
      isLoading={isFetching && !data}
      isError={isError && !data}
      isEmpty={!!data && exams.length === 0}
      onRetry={() => refetch()}
      emptyText="No exams have test series yet."
      skeletonCount={6}
      layout="compact"
    >
      {exams.map((exam) => (
        <Link key={exam.id} to={`/exams/${exam.examSlug}`} className={styles.examChip}>
          <span className={styles.examName}>{exam.examName}</span>
          <span className={styles.examCount}>{plural(exam.seriesCount, "series", "series")}</span>
        </Link>
      ))}
    </RecsSection>
  );
};

const QuickLinks: React.FC = () => (
  <section className={styles.recs} aria-labelledby="not-found-links">
    <div className={styles.recsHead}>
      <h2 id="not-found-links" className={styles.recsTitle}>
        <span className={styles.recsIcon} aria-hidden="true">
          <Compass />
        </span>
        Where would you like to go?
      </h2>
    </div>
    <nav className={styles.quickGrid} aria-label="Popular sections">
      {QUICK_LINKS.map(({ label, hint, to, icon: LinkIcon, tone }) => (
        <Link key={to} to={to} className={styles.quickLink}>
          <span className={styles.quickIcon} data-tone={tone} aria-hidden="true">
            <LinkIcon />
          </span>
          <span className={styles.quickText}>
            <span className={styles.quickLabel}>{label}</span>
            <span className={styles.quickHint}>{hint}</span>
          </span>
          <ArrowRight size={16} className={styles.quickArrow} aria-hidden="true" />
        </Link>
      ))}
    </nav>
  </section>
);
