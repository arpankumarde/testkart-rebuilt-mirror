import React, { useState, useMemo } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { useStudentEnrolledCoursesQuery } from '../helpers/useStudentCoursesQuery';
import { EnrolledCourseCard } from '../components/EnrolledCourseCard';
import { Skeleton } from '../components/Skeleton';
import { Button } from '../components/Button';
import { ConsolePageHeader } from '../components/ConsolePageHeader';
import { ConsoleListToolbar, type ConsoleListTab } from '../components/ConsoleListToolbar';
import { ConsoleListEmpty } from '../components/ConsoleListEmpty';
import { BookOpen, AlertTriangle } from "lucide-react";
import styles from "./student.courses.module.css";

type FilterStatus = "all" | "inProgress" | "completed";

export default function StudentCoursesPage() {
  const { data, isFetching, error, refetch } = useStudentEnrolledCoursesQuery();
  const [filter, setFilter] = useState<FilterStatus>("all");

  const enrolledCourses = data?.enrolledCourses;

  const counts = useMemo(() => {
    if (!enrolledCourses) return undefined;
    const completed = enrolledCourses.filter((c) => c.completionPercentage >= 100).length;
    return {
      all: enrolledCourses.length,
      completed,
      inProgress: enrolledCourses.length - completed,
    };
  }, [enrolledCourses]);

  const filteredCourses = useMemo(() => {
    if (!enrolledCourses) return [];
    if (filter === "inProgress") {
      return enrolledCourses.filter((c) => c.completionPercentage < 100);
    }
    if (filter === "completed") {
      return enrolledCourses.filter((c) => c.completionPercentage >= 100);
    }
    return enrolledCourses;
  }, [enrolledCourses, filter]);

  const tabs: ConsoleListTab[] = [
    { value: "all", label: "All", count: counts?.all },
    { value: "inProgress", label: "In progress", count: counts?.inProgress },
    { value: "completed", label: "Completed", count: counts?.completed },
  ];

  const renderContent = () => {
    if (isFetching) {
      return (
        <div className={styles.coursesGrid}>
          {Array.from({ length: 4 }).map((_, i) =>
            <Skeleton key={i} className={styles.cardSkeleton} />
          )}
        </div>
      );
    }

    if (error) {
      return (
        <ConsoleListEmpty
          tone="error"
          icon={<AlertTriangle size={24} />}
          title="Could not load your courses"
          description="The request did not come back. Check your connection and try again."
        >
          <Button variant="outline" onClick={() => refetch()}>Try again</Button>
        </ConsoleListEmpty>
      );
    }

    if (enrolledCourses?.length === 0) {
      return (
        <ConsoleListEmpty
          icon={<BookOpen size={24} />}
          title="No courses yet"
          description="Every course you enrol in shows up here, so you can pick up where you left off."
        >
          <Button asChild>
            <Link to="/course">Browse courses</Link>
          </Button>
        </ConsoleListEmpty>
      );
    }

    if (filteredCourses.length === 0) {
      return (
        <ConsoleListEmpty
          icon={<BookOpen size={24} />}
          title={filter === "completed" ? "Nothing finished yet" : "Nothing in progress"}
          description={
            filter === "completed"
              ? "Courses you watch all the way through will collect here."
              : "You have finished every course you are enrolled in."
          }
        >
          <Button variant="outline" onClick={() => setFilter("all")}>Show all courses</Button>
        </ConsoleListEmpty>
      );
    }

    return (
      <div className={styles.coursesGrid}>
        {filteredCourses.map((course) =>
          <EnrolledCourseCard key={course.id} course={course} />
        )}
      </div>
    );
  };

  return (
    <>
      <Helmet>
        <title>Courses | Testkart</title>
        <meta
          name="description"
          content="Access and manage all your enrolled courses on Testkart." />
      </Helmet>
      <div className={styles.page}>
        <ConsolePageHeader title="Courses">
          <Button asChild variant="outline">
            <Link to="/course">Browse courses</Link>
          </Button>
        </ConsolePageHeader>

        <ConsoleListToolbar
          tabs={tabs}
          value={filter}
          onValueChange={(value) => setFilter(value as FilterStatus)}
          tabsLabel="Filter courses by progress"
        />

        {renderContent()}
      </div>
    </>
  );
}
