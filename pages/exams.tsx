import React, { useState, useMemo, useCallback, useRef } from "react";
import { Helmet } from "react-helmet";
import { SEOHead } from "../components/SEOHead";

import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getExamDirectory, type DirectoryExam } from "../endpoints/exams/directory_GET.schema";
import { Search, X, ArrowRight, ArrowLeft, ChevronRight, ChevronDown, Flame } from "lucide-react";
import { Skeleton } from "../components/Skeleton";
import { Input } from "../components/Input";
import { useDebounce } from "../helpers/useDebounce";
import styles from "./exams.module.css";

const DOMAIN = "https://testkart.in";
const CANONICAL_URL = `${DOMAIN}/exams`;

// How many exams to preview per category on the "All" overview before a
// student has to click through - keeps the initial view scannable instead
// of dumping all ~1,700 exams into one wall of cards.
const PREVIEW_COUNT = 24;

// Category pills shown before "More categories" is opened. Phones get fewer
// (see .pillExtraMobile) so the filter does not push the list off screen.
const PILLS_COLLAPSED = 12;
const PILLS_COLLAPSED_MOBILE = 6;

// Categories moved to the end: their pill always sits behind "More
// categories" and their section closes the overview.
const MORE_ONLY_CATEGORIES = new Set(["campus placements"]);

const isMoreOnly = (categoryName: string) => MORE_ONLY_CATEGORIES.has(categoryName.trim().toLowerCase());

// One pastel accent per category, cycled in directory order.
const ACCENT_CLASSES = [
  styles.accentPeach,
  styles.accentLavender,
  styles.accentSage,
  styles.accentBlue,
  styles.accentButter,
  styles.accentMint,
];

const accentFor = (index: number) => ACCENT_CLASSES[index % ACCENT_CLASSES.length];

type ExamRow = DirectoryExam;

type CategoryView = {
  id: number;
  categoryName: string;
  accent: string;
  exams: ExamRow[];
};

type SearchRow = {
  key: string;
  exam: ExamRow;
  categoryName: string;
  accent: string;
};

function sortByName(exams: ExamRow[]): ExamRow[] {
  return [...exams].sort((a, b) => a.examName.localeCompare(b.examName));
}

// Overview previews lead with Hot exams so none hides past the first 24.
function sortForPreview(exams: ExamRow[], hotIds: Set<number>): ExamRow[] {
  const sorted = sortByName(exams);
  return [...sorted.filter((exam) => hotIds.has(exam.id)), ...sorted.filter((exam) => !hotIds.has(exam.id))];
}

function matchesSearch(exam: ExamRow, query: string): boolean {
  const q = query.toLowerCase();
  return (
    exam.examName.toLowerCase().includes(q) ||
    (exam.fullName?.toLowerCase().includes(q) ?? false)
  );
}

const plural = (count: number, word: string, many = `${word}s`) =>
  `${count.toLocaleString("en-IN")} ${count === 1 ? word : many}`;

const ExamCard: React.FC<{ exam: ExamRow; accent: string; hot: boolean; categoryName?: string }> = ({
  exam,
  accent,
  hot,
  categoryName,
}) => (
  <Link
    to={`/exams/${exam.examSlug}`}
    className={`${styles.examCard} ${accent}`}
    title={exam.fullName || exam.examName}
  >
    <span className={styles.cardText}>
      <span className={styles.cardTitleRow}>
        <span className={styles.cardName}>{exam.examName}</span>
        {hot && (
          <span className={styles.hotBadge}>
            <Flame size={12} aria-hidden="true" />
            Hot
            <span className={styles.srOnly}> - recent exam news</span>
          </span>
        )}
      </span>
      {categoryName && <span className={styles.cardCategory}>{categoryName}</span>}
    </span>
    <ChevronRight size={16} className={styles.cardChevron} aria-hidden="true" />
  </Link>
);

const CategoryMark: React.FC<{ name: string }> = ({ name }) => (
  <span className={styles.categoryMark} aria-hidden="true">
    {name.trim().charAt(0).toUpperCase()}
  </span>
);

const ExamsPage: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [pillsExpanded, setPillsExpanded] = useState(false);
  const debouncedSearch = useDebounce(search.trim(), 250);
  const directoryRef = useRef<HTMLElement>(null);

  // Prefetched for SSR in exams.prefetch.ts under the same key.
  const { data, isFetching, error } = useQuery({
    queryKey: ["public-exam-directory"],
    queryFn: () => getExamDirectory(),
  });

  const categories = useMemo<CategoryView[]>(() => {
    if (!data) return [];
    const views = data.categories.map((category, index) => ({
      id: category.id,
      categoryName: category.categoryName,
      accent: accentFor(index),
      exams: category.exams,
    }));
    return [
      ...views.filter((category) => !isMoreOnly(category.categoryName)),
      ...views.filter((category) => isMoreOnly(category.categoryName)),
    ];
  }, [data]);

  // Missing on a directory response cached before the field existed.
  const hotIds = useMemo(() => new Set(data?.hotExamIds ?? []), [data]);

  const allExams = useMemo(() => categories.flatMap((category) => category.exams), [categories]);

  const nonEmptyCategoryCount = useMemo(
    () => categories.filter((category) => category.exams.length > 0).length,
    [categories],
  );

  const handleCategorySelect = useCallback((categoryName: string) => {
    setActiveCategory(categoryName);
    setSearch("");
  }, []);

  // From a section footer deep in the overview, the view swaps to a shorter
  // list, so bring the filter back into view instead of leaving the reader
  // stranded below it.
  const openCategory = useCallback(
    (categoryName: string) => {
      handleCategorySelect(categoryName);
      const nav = directoryRef.current;
      if (nav && nav.getBoundingClientRect().top < 0) {
        nav.scrollIntoView({ block: "start" });
      }
    },
    [handleCategorySelect],
  );

  const handleClearSearch = useCallback(() => setSearch(""), []);

  // Search always spans every exam, regardless of which category pill is
  // active - a student searching "neet" while browsing "State Government
  // Recruitment" should still find NEET under Campus/School exams instead
  // of seeing "no results".
  const searchResults = useMemo<SearchRow[]>(() => {
    if (!debouncedSearch) return [];
    return categories
      .flatMap((category) =>
        category.exams
          .filter((exam) => matchesSearch(exam, debouncedSearch))
          .map((exam) => ({
            key: `${category.id}-${exam.id}`,
            exam,
            categoryName: category.categoryName,
            accent: category.accent,
          })),
      )
      .sort((a, b) => a.exam.examName.localeCompare(b.exam.examName));
  }, [categories, debouncedSearch]);

  const activeCategoryView = useMemo(() => {
    if (activeCategory === "All") return null;
    const category = categories.find((c) => c.categoryName === activeCategory);
    return category ? { ...category, exams: sortByName(category.exams) } : null;
  }, [activeCategory, categories]);

  const isSearching = debouncedSearch.length > 0;

  const structuredData = useMemo(() => {
    if (!data) return null;

    const examItems = allExams.map((exam, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: exam.fullName,
      url: `${DOMAIN}/exams/${exam.examSlug}`,
    }));

    return {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "CollectionPage",
          name: "Popular Exams in India",
          description:
            "Browse and explore mock test series for all major competitive exams including SSC, Banking, Railways, UPSC, Teaching, and Engineering exams.",
          url: CANONICAL_URL,
        },
        {
          "@type": "WebPage",
          name: "Popular Exams in India | Testkart",
          description:
            "Explore comprehensive mock test series for SSC CGL, SBI PO, IBPS, Railway RRB, UPSC CSE, GATE, JEE, NEET, and 30+ other competitive exams. Prepare with India's top educators on Testkart.",
          url: CANONICAL_URL,
        },
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: "Home",
              item: DOMAIN,
            },
            {
              "@type": "ListItem",
              position: 2,
              name: "Exams",
              item: CANONICAL_URL,
            },
          ],
        },
        {
          "@type": "ItemList",
          itemListElement: examItems,
        },
      ],
    };
  }, [allExams, data]);

  const renderPills = () => {
    const pills = [
      { key: "all", name: "All", count: allExams.length, accent: "", moreOnly: false },
      ...categories.map((category) => ({
        key: String(category.id),
        name: category.categoryName,
        count: category.exams.length,
        accent: category.accent,
        moreOnly: isMoreOnly(category.categoryName),
      })),
    ];

    return (
      <div id="exam-category-pills" className={styles.pillList}>
        {pills.map((pill, index) => {
          const isActive = activeCategory === pill.name;
          let collapseClass = "";
          if (!pillsExpanded && !isActive) {
            if (pill.moreOnly || index >= PILLS_COLLAPSED) collapseClass = styles.pillExtra;
            else if (index >= PILLS_COLLAPSED_MOBILE) collapseClass = styles.pillExtraMobile;
          }
          return (
            <button
              key={pill.key}
              type="button"
              aria-pressed={isActive}
              onClick={() => handleCategorySelect(pill.name)}
              className={`${styles.pill} ${pill.accent} ${isActive ? styles.pillActive : ""} ${collapseClass}`}
            >
              {pill.accent && <span className={styles.pillDot} aria-hidden="true" />}
              <span className={styles.pillLabel}>{pill.name}</span>
              <span className={styles.pillCount}>{pill.count.toLocaleString("en-IN")}</span>
            </button>
          );
        })}
        {pills.length > PILLS_COLLAPSED_MOBILE && (
          <button
            type="button"
            className={`${styles.pillToggle} ${pills.length > PILLS_COLLAPSED ? "" : styles.mobileOnly}`}
            aria-expanded={pillsExpanded}
            aria-controls="exam-category-pills"
            onClick={() => setPillsExpanded((open) => !open)}
          >
            {pillsExpanded ? "Fewer categories" : "More categories"}
            <ChevronDown
              size={16}
              aria-hidden="true"
              className={`${styles.pillToggleIcon} ${pillsExpanded ? styles.pillToggleIconOpen : ""}`}
            />
          </button>
        )}
      </div>
    );
  };

  const renderOverview = () => (
    <div className={styles.sections}>
      {categories.map((category) => {
        const exams = sortForPreview(category.exams, hotIds);
        if (exams.length === 0) return null;
        const preview = exams.slice(0, PREVIEW_COUNT);
        const remaining = exams.length - preview.length;
        const headingId = `exam-category-${category.id}`;
        return (
          <section
            key={category.id}
            className={`${styles.categorySection} ${category.accent}`}
            aria-labelledby={headingId}
          >
            <div className={styles.sectionHeader}>
              <CategoryMark name={category.categoryName} />
              <h2 id={headingId} className={styles.sectionTitle}>
                {category.categoryName}
              </h2>
              <span className={styles.countChip}>{plural(exams.length, "exam")}</span>
            </div>
            <div className={styles.examsGrid}>
              {preview.map((exam) => (
                <ExamCard key={exam.id} exam={exam} accent={category.accent} hot={hotIds.has(exam.id)} />
              ))}
            </div>
            {remaining > 0 && (
              <div className={styles.sectionFooter}>
                <span className={styles.sectionFooterNote}>
                  Showing {preview.length} of {exams.length.toLocaleString("en-IN")}
                </span>
                <button
                  type="button"
                  className={styles.viewAllButton}
                  onClick={() => openCategory(category.categoryName)}
                >
                  View all {exams.length.toLocaleString("en-IN")}
                  <span className={styles.srOnly}> {category.categoryName}</span> exams
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );

  const renderSearch = () => (
    <>
      <div className={styles.resultsBar}>
        <p className={styles.resultsSummary} aria-live="polite">
          {searchResults.length === 0 ? (
            <>
              No exams match <strong>"{debouncedSearch}"</strong>
            </>
          ) : (
            <>
              <strong>{plural(searchResults.length, "exam")}</strong> match{" "}
              <strong>"{debouncedSearch}"</strong> across all categories
            </>
          )}
        </p>
        <button type="button" className={styles.clearButton} onClick={handleClearSearch}>
          <X size={16} aria-hidden="true" /> Clear search
        </button>
      </div>
      {searchResults.length > 0 ? (
        <section className={styles.categorySection} aria-label="Search results">
          <div className={styles.examsGrid}>
            {searchResults.map((row) => (
              <ExamCard
                key={row.key}
                exam={row.exam}
                accent={row.accent}
                hot={hotIds.has(row.exam.id)}
                categoryName={row.categoryName}
              />
            ))}
          </div>
        </section>
      ) : (
        <div className={`${styles.categorySection} ${styles.emptyState}`}>
          <p className={styles.emptyTitle}>Nothing found</p>
          <p>Try a different spelling, or browse by category above.</p>
        </div>
      )}
    </>
  );

  const renderCategory = () => {
    if (!activeCategoryView) return null;
    const headingId = `exam-category-${activeCategoryView.id}`;
    return (
      <section
        className={`${styles.categorySection} ${activeCategoryView.accent}`}
        aria-labelledby={headingId}
      >
        <div className={styles.sectionHeader}>
          <CategoryMark name={activeCategoryView.categoryName} />
          <h2 id={headingId} className={styles.sectionTitle}>
            {activeCategoryView.categoryName}
          </h2>
          <span className={styles.countChip}>{plural(activeCategoryView.exams.length, "exam")}</span>
          <button type="button" className={styles.backButton} onClick={() => handleCategorySelect("All")}>
            <ArrowLeft size={16} aria-hidden="true" /> All categories
          </button>
        </div>
        {activeCategoryView.exams.length > 0 ? (
          <div className={styles.examsGrid}>
            {activeCategoryView.exams.map((exam) => (
              <ExamCard key={exam.id} exam={exam} accent={activeCategoryView.accent} hot={hotIds.has(exam.id)} />
            ))}
          </div>
        ) : (
          <p className={styles.emptyInline}>No exams in this category yet.</p>
        )}
      </section>
    );
  };

  return (
    <>
      <SEOHead
        title="Browse Exams"
        description="Choose your exam from JEE, NEET, UPSC, SSC, Banking, Railway and more. Find expert-created mock tests for your preparation."
        url={CANONICAL_URL}
      />
      <Helmet>
        {structuredData && (
          <script type="application/ld+json">
            {JSON.stringify(structuredData)}
          </script>
        )}
      </Helmet>
      <div className={styles.pageContainer}>
        <header className={styles.hero}>
          <span className={styles.heroChip}>
            {data
              ? `${plural(allExams.length, "exam")} in ${plural(nonEmptyCategoryCount, "category", "categories")}`
              : "Exam directory"}
          </span>
          <h1 className={styles.heroTitle}>
            <span className={styles.heroTitleMain}>
              Find Your <span className={styles.heroHighlight}>Exam</span>
            </span>
            <span className={styles.srOnly}> - </span>
            <span className={styles.heroTitleSub}>Browse Competitive Exams by Category</span>
          </h1>
          <p className={styles.heroSubtitle}>
            Explore test series for every competitive exam, made by India's top educators.
          </p>

          <div className={`${styles.searchBar} ${search ? styles.searchActive : ""}`}>
            <Search size={20} className={styles.searchIcon} aria-hidden="true" />
            <Input
              type="search"
              aria-label="Search exams"
              placeholder={
                data ? `Search from ${allExams.length.toLocaleString("en-IN")} exams…` : "Search exams…"
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={styles.searchInput}
            />
            {search && (
              <button
                type="button"
                className={styles.searchClear}
                onClick={handleClearSearch}
                aria-label="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </header>

        {isFetching ? (
          <div className={styles.loadingContainer}>
            <div className={styles.pillList}>
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton
                  key={i}
                  style={{
                    height: "2.5rem",
                    width: `${90 + ((i * 37) % 90)}px`,
                    borderRadius: "var(--radius-full)",
                  }}
                />
              ))}
            </div>
            <div className={styles.categorySection}>
              <div className={styles.sectionHeader}>
                <Skeleton style={{ width: "2.5rem", height: "2.5rem", borderRadius: "0.875rem" }} />
                <Skeleton style={{ width: "12rem", height: "1.25rem", borderRadius: "var(--radius-sm)" }} />
              </div>
              <div className={styles.examsGrid}>
                {Array.from({ length: 16 }).map((_, i) => (
                  <div key={i} className={styles.examCardSkeleton}>
                    <Skeleton
                      style={{
                        width: `${55 + ((i * 13) % 35)}%`,
                        height: "14px",
                        borderRadius: "var(--radius-sm)",
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : error ? (
          <div className={`${styles.categorySection} ${styles.emptyState}`}>
            <p className={styles.emptyTitle}>Failed to load exams</p>
            <p>Please try again later.</p>
          </div>
        ) : data ? (
          <>
            <nav ref={directoryRef} className={styles.filterNav} aria-label="Exam categories">
              {renderPills()}
            </nav>

            {isSearching ? renderSearch() : activeCategory === "All" ? renderOverview() : renderCategory()}
          </>
        ) : null}
      </div>
    </>
  );
};

export default ExamsPage;
