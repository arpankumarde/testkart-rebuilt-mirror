import React, { useState, useMemo } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { useEnrolledTestsQuery } from '../helpers/useEnrolledTestsQuery';
import { EnrolledTestCard } from '../components/EnrolledTestCard';
import { Skeleton } from '../components/Skeleton';
import { Button } from '../components/Button';
import { ConsolePageHeader } from '../components/ConsolePageHeader';
import { ConsoleListToolbar, type ConsoleListTab } from '../components/ConsoleListToolbar';
import { ConsoleListEmpty } from '../components/ConsoleListEmpty';
import { BookCopy, AlertTriangle } from "lucide-react";
import styles from "./student.tests.module.css";

type FilterStatus = "all" | "inProgress" | "completed";

export default function StudentTestsPage() {
  const { data, isFetching, error, refetch } = useEnrolledTestsQuery();
  const [filter, setFilter] = useState<FilterStatus>("all");

  const enrolledTests = data?.enrolledTests;

  const counts = useMemo(() => {
    if (!enrolledTests) return undefined;
    const completed = enrolledTests.filter((t) => t.completedItems === t.totalItems).length;
    return {
      all: enrolledTests.length,
      completed,
      inProgress: enrolledTests.length - completed,
    };
  }, [enrolledTests]);

  const filteredTests = useMemo(() => {
    if (!enrolledTests) return [];
    if (filter === "inProgress") {
      return enrolledTests.filter((t) => t.completedItems < t.totalItems);
    }
    if (filter === "completed") {
      return enrolledTests.filter((t) => t.completedItems === t.totalItems);
    }
    return enrolledTests;
  }, [enrolledTests, filter]);

  const tabs: ConsoleListTab[] = [
    { value: "all", label: "All", count: counts?.all },
    { value: "inProgress", label: "In progress", count: counts?.inProgress },
    { value: "completed", label: "Completed", count: counts?.completed },
  ];

  const renderContent = () => {
    if (isFetching) {
      return (
        <div className={styles.testsGrid}>
          {Array.from({ length: 2 }).map((_, i) =>
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
          title="Could not load your tests"
          description="The request did not come back. Check your connection and try again."
        >
          <Button variant="outline" onClick={() => refetch()}>Try again</Button>
        </ConsoleListEmpty>
      );
    }

    if (enrolledTests?.length === 0) {
      return (
        <ConsoleListEmpty
          icon={<BookCopy size={24} />}
          title="No tests yet"
          description="Every test series you enrol in shows up here, with your progress and scores."
        >
          <Button asChild>
            <Link to="/mock-test">Browse tests</Link>
          </Button>
        </ConsoleListEmpty>
      );
    }

    if (filteredTests.length === 0) {
      return (
        <ConsoleListEmpty
          icon={<BookCopy size={24} />}
          title={filter === "completed" ? "Nothing finished yet" : "Nothing in progress"}
          description={
            filter === "completed"
              ? "Tests you finish every item of will collect here."
              : "You have finished every test you are enrolled in."
          }
        >
          <Button variant="outline" onClick={() => setFilter("all")}>Show all tests</Button>
        </ConsoleListEmpty>
      );
    }

    return (
      <div className={styles.testsGrid}>
        {filteredTests.map((test) =>
          <EnrolledTestCard key={test.id} enrolledTest={test} />
        )}
      </div>
    );
  };

  return (
    <>
      <Helmet>
        <title>Mock tests | Testkart</title>
        <meta
          name="description"
          content="Access and manage all your enrolled mock tests on Testkart. Track your progress and view performance."
        />
      </Helmet>
      <div className={styles.page}>
        <ConsolePageHeader title="Mock tests">
          <Button asChild variant="outline">
            <Link to="/mock-test">Browse tests</Link>
          </Button>
        </ConsolePageHeader>

        <ConsoleListToolbar
          tabs={tabs}
          value={filter}
          onValueChange={(value) => setFilter(value as FilterStatus)}
          tabsLabel="Filter tests by progress"
        />

        {renderContent()}
      </div>
    </>
  );
}
