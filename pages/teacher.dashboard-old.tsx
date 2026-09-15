import React from "react";
import { Helmet } from "react-helmet";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from '../helpers/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import { useTeacherDashboardStats, TEACHER_DASHBOARD_STATS_QUERY_KEY } from '../helpers/useTeacherDashboardStats';
import { useBlogPostsQuery } from '../helpers/useBlogQuery';
import { SponsorStudentDialog } from '../components/SponsorStudentDialog';
import { Button } from '../components/Button';
import { Skeleton } from '../components/Skeleton';
import { Badge } from '../components/Badge';
import { BookCopy, BookOpen, FileText } from "lucide-react";
import { TeacherDashboardStats } from "../components/TeacherDashboardStats";
import { TeacherDashboardQuickActions } from "../components/TeacherDashboardQuickActions";
import { TeacherDashboardRecentSponsored } from "../components/TeacherDashboardRecentSponsored";
import styles from "./teacher.dashboard-old.module.css";

const DashboardSkeleton: React.FC = () => (
  <div className={styles.container}>
    <Skeleton style={{ height: "2.5rem", width: "200px", marginBottom: "var(--spacing-8)" }} />
    <div className={styles.statsGridSkeleton}>
      <Skeleton style={{ height: "160px", width: "100%" }} />
      <Skeleton style={{ height: "160px", width: "100%" }} />
      <Skeleton style={{ height: "160px", width: "100%" }} />
      <Skeleton style={{ height: "160px", width: "100%" }} />
    </div>
  </div>
);

const TeacherDashboardPage: React.FC = () => {
  const { authState } = useAuth();
  
  // Queries
  const queryClient = useQueryClient();
  const { data: dashboardStats, isFetching: statsLoading, isError, error } = useTeacherDashboardStats();
  const { data: kbData, isFetching: kbLoading } = useBlogPostsQuery({ type: "knowledge_base", limit: 6 });

  const navigate = useNavigate();

  // Dialog States
  const [isSponsorDialogOpen, setIsSponsorDialogOpen] = React.useState(false);

  if (authState.type === "loading") {
    return <DashboardSkeleton />;
  }

  if (authState.type !== "authenticated") {
    return null;
  }

  // Calculate stats
  const totalStudents = dashboardStats?.totalUniqueStudents ?? 0;

  // Top content logic
  const topTests = dashboardStats?.topTests ?? [];
  
  const topCourses = dashboardStats?.topCourses ?? [];

  return (
    <>
      <Helmet>
        <title>Teacher Dashboard - Testkart</title>
        <meta name="description" content="Manage your mock tests and view earnings on Testkart." />
      </Helmet>
      <div className={styles.container}>
        {isError && (
          <div className={styles.errorBanner}>
            <p>Failed to load dashboard data: {error instanceof Error ? error.message : "Unknown error"}</p>
          </div>
        )}

        {(kbLoading || (kbData?.posts && kbData.posts.length > 0)) && (
          <div className={styles.kbSection}>
            <div className={styles.kbHeader}>
              <h2 className={styles.kbTitle}>📚 Guides &amp; Tutorials</h2>
              <Button asChild variant="ghost" size="sm">
                <Link to="/help">View All</Link>
              </Button>
            </div>
            <div className={styles.kbScrollContainer}>
              {kbLoading ? (
                Array(4).fill(0).map((_, i) => (
                  <Skeleton key={i} style={{ flex: "0 0 240px", height: "3.5rem", borderRadius: "var(--radius)" }} />
                ))
              ) : (
                kbData?.posts.map((post) => (
                  <Link key={post.id} to={`/help/${post.slug}`} className={styles.kbCard}>
                    <FileText size={18} className={styles.kbIcon} />
                    <span className={styles.kbCardTitle}>{post.title}</span>
                  </Link>
                ))
              )}
            </div>
          </div>
        )}

        <header className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Overview</h1>
          <div className={styles.headerActions}>
            <Badge variant="outline" className={styles.monthlyBadge}>Monthly</Badge>
          </div>
        </header>

        <TeacherDashboardStats
          totalStudents={totalStudents}
          studentsLoading={statsLoading}
          availableBalance={dashboardStats?.availableBalance ?? 0}
          balanceLoading={statsLoading}
          onRefreshBalance={() => queryClient.invalidateQueries({ queryKey: TEACHER_DASHBOARD_STATS_QUERY_KEY })}
          isRefreshingBalance={statsLoading}
          publishedTestsCount={dashboardStats?.counts.publishedTestsCount ?? 0}
          totalTestsCount={dashboardStats?.counts.totalTestsCount ?? 0}
          testsLoading={statsLoading}
          publishedCoursesCount={dashboardStats?.counts.publishedCoursesCount ?? 0}
          totalCoursesCount={dashboardStats?.counts.totalCoursesCount ?? 0}
          coursesLoading={statsLoading}
          publishedBundlesCount={dashboardStats?.counts.publishedBundlesCount ?? 0}
          totalBundlesCount={dashboardStats?.counts.totalBundlesCount ?? 0}
          bundlesLoading={statsLoading}
          publishedProductsCount={dashboardStats?.counts.publishedProductsCount ?? 0}
          totalProductsCount={dashboardStats?.counts.totalProductsCount ?? 0}
          productsLoading={statsLoading}
        />

        <TeacherDashboardQuickActions
          onSponsorClick={() => setIsSponsorDialogOpen(true)}
          onBundleClick={() => navigate('/teacher/bundles/create')}
        />

        <div className={styles.twoColumnLayout}>
          <div className={styles.leftColumn}>
            <div className={styles.topTestsCard}>
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>Top Test Series</h2>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/teacher/test-series">View All</Link>
                </Button>
              </div>
              <div className={styles.testsList}>
                {statsLoading ? (
                  Array(3).fill(0).map((_, i) => (
                    <div key={i} className={styles.testItem}>
                      <Skeleton style={{ width: "60px", height: "60px", borderRadius: "var(--radius)" }} />
                      <div className={styles.testItemContent}>
                        <Skeleton style={{ width: "200px", height: "1.25rem", marginBottom: "var(--spacing-2)" }} />
                        <Skeleton style={{ width: "150px", height: "1rem" }} />
                      </div>
                    </div>
                  ))
                ) : topTests.length > 0 ? (
                  topTests.map((test) => (
                    <Link
                      key={test.id}
                      to={`/teacher/test/${test.id}/edit`}
                      className={styles.testItem}
                    >
                      <div className={styles.testThumbnail}>
                        {test.thumbnailUrl ? (
                          <img src={test.thumbnailUrl} alt={test.title} />
                        ) : (
                          <div className={styles.testThumbnailPlaceholder}>
                            <BookCopy size={24} />
                          </div>
                        )}
                      </div>
                      <div className={styles.testItemContent}>
                        <h3 className={styles.testItemTitle}>{test.title}</h3>
                        <p className={styles.testItemMeta}>
                          {test.studentsEnrolled} students · ₹{test.price.toFixed(2)}
                        </p>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className={styles.emptyTests}>
                    <p className={styles.emptyTestsText}>No tests created yet</p>
                    <Button asChild size="sm">
                      <Link to="/teacher/create-test">Create Your First Test</Link>
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className={styles.topTestsCard}>
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>Top Courses</h2>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/teacher/courses">View All</Link>
                </Button>
              </div>
              <div className={styles.testsList}>
                {statsLoading ? (
                  Array(3).fill(0).map((_, i) => (
                    <div key={i} className={styles.testItem}>
                      <Skeleton style={{ width: "60px", height: "60px", borderRadius: "var(--radius)" }} />
                      <div className={styles.testItemContent}>
                        <Skeleton style={{ width: "200px", height: "1.25rem", marginBottom: "var(--spacing-2)" }} />
                        <Skeleton style={{ width: "150px", height: "1rem" }} />
                      </div>
                    </div>
                  ))
                ) : topCourses.length > 0 ? (
                  topCourses.map((course) => (
                    <Link
                      key={course.id}
                      to={`/teacher/courses/${course.id}/edit`}
                      className={styles.testItem}
                    >
                      <div className={styles.testThumbnail}>
                        {course.thumbnailImageUrl ? (
                          <img src={course.thumbnailImageUrl} alt={course.title} />
                        ) : (
                          <div className={styles.testThumbnailPlaceholder}>
                            <BookOpen size={24} />
                          </div>
                        )}
                      </div>
                      <div className={styles.testItemContent}>
                        <h3 className={styles.testItemTitle}>{course.title}</h3>
                        <p className={styles.testItemMeta}>
                          {course.lessonsCount} lessons · ₹{course.price.toFixed(2)}
                        </p>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className={styles.emptyTests}>
                    <p className={styles.emptyTestsText}>No courses created yet</p>
                    <Button asChild size="sm">
                      <Link to="/teacher/courses/create">Create Your First Course</Link>
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className={styles.rightColumn}>
            <TeacherDashboardRecentSponsored
              recentSponsored={dashboardStats?.recentSponsored ?? []}
              isLoading={statsLoading}
            />
          </div>
        </div>

        <SponsorStudentDialog
          open={isSponsorDialogOpen}
          onOpenChange={setIsSponsorDialogOpen}
        />
      </div>
    </>
  );
};

export default TeacherDashboardPage;