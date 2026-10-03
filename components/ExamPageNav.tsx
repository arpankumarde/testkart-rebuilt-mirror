import React from "react";
import { Link } from "react-router-dom";
import {
  BookOpen,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  FileText,
  GraduationCap,
  LayoutGrid,
  ListChecks,
  Package,
  TrendingUp,
  UserCheck,
} from "lucide-react";
import { useExamProductCountsQuery } from "../helpers/useExamProductCounts";
import {
  EXAM_CONTENT_PAGE_META,
  EXAM_CONTENT_PAGE_TYPES,
  type ExamContentPageType,
} from "../helpers/examContentTypes";
import type { ExamProductCounts } from "../endpoints/exam-products/counts_GET.schema";
import styles from "./ExamPageNav.module.css";

export type ExamNavLink = {
  slug: string | null;
  label: string;
};

// A product listing page redirects to the hub when the exam has no items of
// that type, so its tab only appears when the count is above zero.
const PRODUCT_LINKS: (ExamNavLink & { countKey: keyof ExamProductCounts; icon: React.ReactNode })[] = [
  { slug: "mock-tests", label: "Mock Tests", countKey: "mockTests", icon: <ClipboardCheck size={16} /> },
  { slug: "courses", label: "Courses", countKey: "courses", icon: <GraduationCap size={16} /> },
  { slug: "study-notes", label: "Study Notes", countKey: "digitalProducts", icon: <BookOpen size={16} /> },
  { slug: "bundles", label: "Bundles", countKey: "bundles", icon: <Package size={16} /> },
];

// Informational pages for the Important Links panel: the Overview hub, then
// the published built-in content pages, then published admin-added pages.
export function getExamInfoLinks(
  publishedPageTypes: ExamContentPageType[],
  customPages: { slug: string; label: string }[] = []
): ExamNavLink[] {
  return [
    { slug: null, label: "Overview" },
    ...EXAM_CONTENT_PAGE_TYPES.filter((type) => publishedPageTypes.includes(type)).map((type) => ({
      slug: EXAM_CONTENT_PAGE_META[type].slug,
      label: EXAM_CONTENT_PAGE_META[type].label,
    })),
    ...customPages.map((page) => ({ slug: page.slug, label: page.label })),
  ];
}

const linkUrl = (examSlug: string, slug: string | null) =>
  slug ? `/exams/${examSlug}/${slug}` : `/exams/${examSlug}`;

interface ExamProductTabsProps {
  examSlug: string;
  // URL segment of the page being shown ("mock-tests"); null when no product page is active.
  currentSlug: string | null;
  className?: string;
}

// Product-only tab bar (Mock Tests, Courses, Study Notes, Bundles), attached
// to the bottom of the exam page header (ExamPageHeader's `tabs` slot). Each
// tab's pastel comes from its data-tab slug in ExamPageNav.module.css.
export const ExamProductTabs: React.FC<ExamProductTabsProps> = ({ examSlug, currentSlug, className }) => {
  const { data: countsData } = useExamProductCountsQuery(examSlug);
  const tabs = PRODUCT_LINKS.filter((link) => (countsData?.counts[link.countKey] ?? 0) > 0);

  if (tabs.length === 0) return null;

  return (
    <nav className={`${styles.tabs} ${className ?? ""}`} aria-label="Study material">
      {tabs.map((tab) => {
        const isCurrent = tab.slug === currentSlug;
        return (
          <Link
            key={tab.slug}
            to={linkUrl(examSlug, tab.slug)}
            className={`${styles.tab} ${isCurrent ? styles.tabCurrent : ""}`}
            aria-current={isCurrent ? "page" : undefined}
            data-tab={tab.slug}
          >
            <span className={styles.tabIcon} aria-hidden="true">
              <span className={styles.tabBlob} />
              {tab.icon}
            </span>
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
};

// Icon per informational page slug; admin-added custom pages fall back to
// a generic document icon.
const INFO_LINK_ICONS: Record<string, React.ReactNode> = {
  overview: <LayoutGrid size={16} />,
  syllabus: <ListChecks size={16} />,
  "exam-pattern": <ClipboardList size={16} />,
  eligibility: <UserCheck size={16} />,
  cutoff: <TrendingUp size={16} />,
};

interface ExamImportantLinksProps {
  examSlug: string;
  // URL segment of the page being shown ("syllabus"); null on the hub.
  currentSlug: string | null;
  links: ExamNavLink[];
  isLoading?: boolean;
  className?: string;
}

// Informational pages panel. A vertical list in the desktop sidebar; below
// the sidebar breakpoint the same list becomes a horizontally scrolling chip
// row (see ExamPageNav.module.css).
export const ExamImportantLinks: React.FC<ExamImportantLinksProps> = ({
  examSlug,
  currentSlug,
  links,
  isLoading = false,
  className,
}) => {
  const listRef = React.useRef<HTMLUListElement>(null);

  // In the mobile chip row, bring the current chip into view without
  // touching the page's vertical scroll (scrollIntoView would).
  React.useEffect(() => {
    const list = listRef.current;
    if (!list || list.scrollWidth <= list.clientWidth) return;
    const current = list.querySelector<HTMLElement>("[aria-current='page']");
    if (!current) return;
    list.scrollLeft = current.offsetLeft - (list.clientWidth - current.offsetWidth) / 2;
  }, [currentSlug, links.length]);

  return (
    <nav className={`${styles.panel} ${className ?? ""}`} aria-label="Important links">
      <div className={styles.panelHeader}>
        <div className={styles.panelHeading}>
          <h2 className={styles.panelTitle}>Important Links</h2>
          <p className={styles.panelSubtitle}>Everything about this exam</p>
        </div>
      </div>
      <ul ref={listRef} className={styles.linkList}>
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className={styles.linkSkeleton} aria-hidden="true" />
            ))
          : links.map((link) => {
              const isCurrent = link.slug === currentSlug;
              return (
                <li key={link.slug ?? "overview"}>
                  <Link
                    to={linkUrl(examSlug, link.slug)}
                    className={`${styles.linkItem} ${isCurrent ? styles.linkItemCurrent : ""}`}
                    aria-current={isCurrent ? "page" : undefined}
                  >
                    <span className={styles.linkIcon} aria-hidden="true">
                      <span className={styles.linkBlob} />
                      {INFO_LINK_ICONS[link.slug ?? "overview"] ?? <FileText size={16} />}
                    </span>
                    <span className={styles.linkLabel}>{link.label}</span>
                    <ChevronRight size={16} className={styles.linkChevron} />
                  </Link>
                </li>
              );
            })}
      </ul>
    </nav>
  );
};
