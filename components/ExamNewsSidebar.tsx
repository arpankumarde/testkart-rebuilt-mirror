import React from "react";
import { Link } from "react-router-dom";
import { BookOpen, ChevronRight, GraduationCap, MonitorPlay, Radio, ListChecks } from "lucide-react";
import { examNewsPublicMeta } from "../helpers/examNewsPublicMeta";
import { EXAM_NEWS_TYPE_ICONS } from "../helpers/examNewsIcons";
import type { OutputType as SidebarData } from "../endpoints/exam-news/sidebar_GET.schema";
import { Skeleton } from "./Skeleton";
import styles from "./ExamNewsSidebar.module.css";

const EXPLORE = [
  { href: "/mock-test", label: "Test Series", hint: "Mock tests by top educators", icon: ListChecks },
  { href: "/course", label: "Courses", hint: "Video courses for every exam", icon: MonitorPlay },
  { href: "/study-notes", label: "Study Notes", hint: "PDF notes and question banks", icon: BookOpen },
  { href: "/live-test", label: "Live Competitions", hint: "Compete live and win prizes", icon: Radio },
];

interface ExamNewsSidebarProps {
  data: SidebarData | undefined;
  isLoading: boolean;
  activeExam?: string;
  /* The story page shows its related updates instead of the recently updated list. */
  showRecent?: boolean;
  /* The listing pages leave out Browse by type and Prepare on Testkart. */
  showBrowse?: boolean;
  children?: React.ReactNode;
}

export const ExamNewsSidebar: React.FC<ExamNewsSidebarProps> = ({ data, isLoading, activeExam, showRecent = true, showBrowse = true, children }) => {
  const exams = data
    ? [...data.popularExams, ...data.examsWithNews.filter((e) => !data.popularExams.some((p) => p.slug === e.slug))].slice(0, 10)
    : [];
  const recent = data?.recentlyUpdated ?? [];
  const recentLoading = isLoading && !data;

  return (
    <aside className={styles.sidebar} aria-label="Exam News sections">
      {children}

      <section className={styles.card} aria-labelledby="en-side-exams">
        <h2 id="en-side-exams" className={styles.title}>
          <GraduationCap size={16} aria-hidden="true" /> Popular exams
        </h2>
        {isLoading && !data ? (
          <Skeleton style={{ height: "4.5rem" }} />
        ) : (
          <ul className={styles.chips}>
            {exams.map((exam) => (
              <li key={exam.slug}>
                <Link
                  to={examNewsPublicMeta.listingPath({ examSlug: exam.slug })}
                  className={`${styles.chip} ${activeExam === exam.slug ? styles.chipActive : ""}`}
                  aria-current={activeExam === exam.slug ? "page" : undefined}
                >
                  {exam.name}
                  {exam.count > 0 && <span className={styles.chipCount}>{exam.count}</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {showBrowse && (
        <section className={styles.card} aria-labelledby="en-side-types">
          <h2 id="en-side-types" className={styles.title}>
            Browse by type
          </h2>
          <ul className={styles.typeList}>
            {examNewsPublicMeta.TYPES.map((type) => {
              const Icon = EXAM_NEWS_TYPE_ICONS[type.value];
              const count = data?.typeCounts[type.value] ?? 0;
              return (
                <li key={type.value}>
                  <Link to={examNewsPublicMeta.listingPath({ type: type.value })} className={styles.typeRow}>
                    <span className={`${styles.typeIcon} ${styles[`icon_${type.value}`] ?? ""}`} aria-hidden="true">
                      <Icon size={14} />
                    </span>
                    <span className={styles.typeLabel}>{type.plural}</span>
                    <span className={styles.typeCount}>{count}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {showRecent && (recentLoading || recent.length > 0) && (
        <section className={styles.card} aria-labelledby="en-side-recent">
          <h2 id="en-side-recent" className={styles.title}>
            Recently updated
          </h2>
          {recentLoading ? (
            <Skeleton style={{ height: "7rem" }} />
          ) : (
            <ol className={styles.recent}>
              {recent.map((item) => (
                <li key={item.slug}>
                  <Link to={examNewsPublicMeta.storyPath(item.slug)} className={styles.recentLink}>
                    {item.title}
                  </Link>
                  <span className={styles.recentMeta}>
                    {[examNewsPublicMeta.typeLabel(item.newsType), item.examName, examNewsPublicMeta.formatDate(item.lastEditedAt)]
                      .filter(Boolean)
                      .join(" - ")}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      {showBrowse && (
        <section className={`${styles.card} ${styles.explore}`} aria-labelledby="en-side-explore">
          <h2 id="en-side-explore" className={styles.title}>
            Prepare on Testkart
          </h2>
          <ul className={styles.exploreList}>
            {EXPLORE.map((link) => (
              <li key={link.href}>
                <Link to={link.href} className={styles.exploreRow}>
                  <span className={styles.exploreIcon} aria-hidden="true">
                    <link.icon size={16} />
                  </span>
                  <span className={styles.exploreText}>
                    <span className={styles.exploreLabel}>{link.label}</span>
                    <span className={styles.exploreHint}>{link.hint}</span>
                  </span>
                  <ChevronRight size={16} className={styles.exploreChevron} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  );
};
