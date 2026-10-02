import React from "react";
import { ExamImportantLinks, getExamInfoLinks } from "./ExamPageNav";
import type { ExamContentPageType } from "../helpers/examContentTypes";
import styles from "./ExamPageShell.module.css";

interface ExamPageShellProps {
  examSlug: string;
  // URL segment of the informational page being shown ("syllabus"); null on
  // the hub. Product pages pass their own slug, which simply matches nothing.
  currentSlug: string | null;
  publishedPageTypes: ExamContentPageType[];
  customPages?: { slug: string; label: string }[];
  // True while the content query that supplies publishedPageTypes is still
  // loading — keeps the sidebar column reserved so the layout doesn't jump.
  linksLoading?: boolean;
  breadcrumb: React.ReactNode;
  header: React.ReactNode;
  children: React.ReactNode;
}

// Shared layout for every /exams/:examSlug page: breadcrumb across the top,
// then the page header + main content on the left and a sticky Important
// Links sidebar on the right. Below 1024px it stacks: header, links (as a
// chip row), main content.
export const ExamPageShell: React.FC<ExamPageShellProps> = ({
  examSlug,
  currentSlug,
  publishedPageTypes,
  customPages = [],
  linksLoading = false,
  breadcrumb,
  header,
  children,
}) => {
  const links = getExamInfoLinks(publishedPageTypes, customPages);
  // Overview alone isn't worth a sidebar — drop the column entirely.
  const hasSidebar = linksLoading || links.length > 1;

  return (
    <div className={styles.pageContainer}>
      {breadcrumb}
      <div className={`${styles.layout} ${hasSidebar ? styles.withSidebar : ""}`}>
        <div className={styles.headerArea}>{header}</div>
        {hasSidebar && (
          <aside className={styles.sidebar}>
            <ExamImportantLinks
              examSlug={examSlug}
              currentSlug={currentSlug}
              links={links}
              isLoading={linksLoading}
            />
          </aside>
        )}
        <div className={styles.mainArea}>{children}</div>
      </div>
    </div>
  );
};
