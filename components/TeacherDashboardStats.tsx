import React from "react";
import { Link } from "react-router-dom";
import { Skeleton } from "./Skeleton";
import { Users, IndianRupee, BookCopy, BookOpen, Package, FileText, RefreshCw } from "lucide-react";
import { Button } from "./Button";
import styles from "./TeacherDashboardStats.module.css";

interface StatCardProps {
  title: string;
  value: string;
  change: React.ReactNode;
  icon: React.ReactNode;
  isLoading?: boolean;
  linkTo?: string;
  action?: React.ReactNode;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, change, icon, isLoading, linkTo, action }) => {
  const CardContent = (
    <div className={styles.statCard}>
      <div className={styles.statCardTop}>
        <div className={styles.statCardIcon}>{icon}</div>
        {action && <div className={styles.statCardAction}>{action}</div>}
      </div>
      <div className={styles.statCardBody}>
        {isLoading ? (
          <>
            <Skeleton style={{ height: "0.8125rem", width: "80px", marginBottom: "var(--spacing-2)" }} />
            <Skeleton style={{ height: "1.5rem", width: "120px", marginBottom: "var(--spacing-2)" }} />
            <Skeleton style={{ height: "0.8125rem", width: "100px" }} />
          </>
        ) : (
          <>
            <p className={styles.statCardTitle}>{title}</p>
            <p className={styles.statCardValue}>{value}</p>
            <p className={styles.statCardCaption}>{change}</p>
          </>
        )}
      </div>
    </div>
  );

  if (linkTo) {
    return (
      <Link to={linkTo} className={styles.statCardLink}>
        {CardContent}
      </Link>
    );
  }

  return CardContent;
};

interface TeacherDashboardStatsProps {
  totalStudents: number;
  studentsLoading: boolean;
  
  availableBalance: number;
  balanceLoading: boolean;
  onRefreshBalance: () => void;
  isRefreshingBalance?: boolean;
  
  publishedTestsCount: number;
  totalTestsCount: number;
  testsLoading: boolean;
  
  publishedCoursesCount: number;
  totalCoursesCount: number;
  coursesLoading: boolean;
  
  publishedBundlesCount: number;
  totalBundlesCount: number;
  bundlesLoading: boolean;

  publishedProductsCount?: number;
  totalProductsCount?: number;
  productsLoading?: boolean;
}

export const TeacherDashboardStats: React.FC<TeacherDashboardStatsProps> = ({
  totalStudents,
  studentsLoading,
  availableBalance,
  balanceLoading,
  onRefreshBalance,
  isRefreshingBalance,
  publishedTestsCount,
  totalTestsCount,
  testsLoading,
  publishedCoursesCount,
  totalCoursesCount,
  coursesLoading,
  publishedBundlesCount,
  totalBundlesCount,
  bundlesLoading,
  publishedProductsCount = 0,
  totalProductsCount = 0,
  productsLoading = false,
}) => {
  const draftTests = totalTestsCount - publishedTestsCount;
  const draftCourses = totalCoursesCount - publishedCoursesCount;
  const draftBundles = totalBundlesCount - publishedBundlesCount;
  const draftProducts = totalProductsCount - publishedProductsCount;

  return (
    <div className={styles.statsGrid}>
      <StatCard
        title="Students"
        value={totalStudents.toLocaleString()}
        isLoading={studentsLoading}
        icon={<Users size={20} />}
        change="Total enrolled students"
      />

      <StatCard
        title="Available Balance"
        value={`₹${availableBalance.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`}
        isLoading={balanceLoading}
        icon={<IndianRupee size={20} />}
        change="Current balance"
        action={
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={(e) => {
              e.preventDefault();
              onRefreshBalance();
            }}
            disabled={isRefreshingBalance || balanceLoading}
            className={styles.refreshButton}
            title="Refresh Balance"
          >
            <RefreshCw size={16} className={isRefreshingBalance ? styles.spinning : ''} />
          </Button>
        }
      />

      <StatCard
        title="Published Mock Tests"
        value={publishedTestsCount.toLocaleString()}
        isLoading={testsLoading}
        icon={<BookCopy size={20} />}
        linkTo="/teacher/test-series"
        change={draftTests > 0 ? `${draftTests} draft${draftTests !== 1 ? 's' : ''}` : 'Click to manage'}
      />

      <StatCard
        title="Published Courses"
        value={publishedCoursesCount.toLocaleString()}
        isLoading={coursesLoading}
        icon={<BookOpen size={20} />}
        linkTo="/teacher/courses"
        change={draftCourses > 0 ? `${draftCourses} draft${draftCourses !== 1 ? 's' : ''}` : 'Click to manage'}
      />

      <StatCard
        title="Course Bundles"
        value={publishedBundlesCount.toLocaleString()}
        isLoading={bundlesLoading}
        icon={<Package size={20} />}
        linkTo="/teacher/bundles"
        change={draftBundles > 0 ? `${draftBundles} draft${draftBundles !== 1 ? 's' : ''}` : 'Click to manage'}
      />

      <StatCard
        title="Published Products"
        value={publishedProductsCount.toLocaleString()}
        isLoading={productsLoading}
        icon={<FileText size={20} />}
        linkTo="/teacher/products"
        change={draftProducts > 0 ? `${draftProducts} draft${draftProducts !== 1 ? 's' : ''}` : 'Click to manage'}
      />
    </div>
  );
};