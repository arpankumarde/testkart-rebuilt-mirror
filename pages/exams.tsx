import React, { useState, useMemo, useCallback } from "react";
import { Helmet } from "react-helmet";
import { SEOHead } from "../components/SEOHead";

import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getPublicExamCategories, type ExamCategoryWithExams } from "../endpoints/exams/list_GET.schema";
import type { Selectable } from "kysely";
import type { Exams } from "../helpers/schema";
import { Search, X, ArrowRight, ArrowLeft, ChevronRight } from "lucide-react";
import { Skeleton } from "../components/Skeleton";
import { Input } from "../components/Input";
import { useDebounce } from "../helpers/useDebounce";
import styles from "./exams.module.css";

const DOMAIN = "https://testkart.in";
const CANONICAL_URL = `${DOMAIN}/exams`;

// How many exams to preview per category on the "All" overview before a
// student has to click through — keeps the initial view scannable instead
// of dumping all ~1,700 exams into one wall of cards.
const PREVIEW_COUNT = 24;

type ExamRow = Selectable<Exams>;

function sortByName(exams: ExamRow[]): ExamRow[] {
  return [...exams].sort((a, b) => a.examName.localeCompare(b.examName));
}

function matchesSearch(exam: ExamRow, query: string): boolean {
  const q = query.toLowerCase();
  return (
    exam.examName.toLowerCase().includes(q) ||
    (exam.fullName?.toLowerCase().includes(q) ?? false)
  );
}

// No icon, no card chrome — at ~1,700 entries a boxy icon card is far too
// heavy. A slim text row lets a category's exams read like a scannable
// index instead of a wall of tiles, and packs many more into one screen.
const ExamCard: React.FC<{ exam: ExamRow }> = ({ exam }) => (
  <Link to={`/exams/${exam.examSlug}`} className={styles.examCard}>
    <span className={styles.cardName}>{exam.examName}</span>
    <ChevronRight size={14} className={styles.cardChevron} />
  </Link>
);

const ExamsPage: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search.trim(), 250);

  const { data, isFetching, error } = useQuery({
    queryKey: ["public-exam-categories"],
    queryFn: () => getPublicExamCategories(),
  });

  const allExams = useMemo(() => {
    if (!data) return [];
    return data.categories.flatMap((category) => category.exams);
  }, [data]);

  const handleCategorySelect = useCallback((categoryName: string) => {
    setActiveCategory(categoryName);
    setSearch("");
  }, []);

  const handleClearSearch = useCallback(() => setSearch(""), []);

  // Search always spans every exam, regardless of which category pill is
  // active — a student searching "neet" while browsing "State Government
  // Recruitment" should still find NEET under Campus/School exams instead
  // of seeing "no results".
  const searchResults = useMemo(() => {
    if (!debouncedSearch) return [];
    return sortByName(allExams.filter((exam) => matchesSearch(exam, debouncedSearch)));
  }, [allExams, debouncedSearch]);

  const activeCategoryExams = useMemo(() => {
    if (activeCategory === "All" || !data) return [];
    const category = data.categories.find((c) => c.categoryName === activeCategory);
    return category ? sortByName(category.exams) : [];
  }, [activeCategory, data]);

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

  const renderOverview = (categories: ExamCategoryWithExams[]) => (
    <div className={styles.categorySections}>
      {categories.map((category) => {
        const exams = sortByName(category.exams);
        const preview = exams.slice(0, PREVIEW_COUNT);
        const remaining = exams.length - preview.length;
        if (exams.length === 0) return null;
        return (
          <section key={category.id} className={styles.categorySection}>
            <div className={styles.categorySectionHeader}>
              <h2 className={styles.categorySectionTitle}>{category.categoryName}</h2>
              <span className={styles.categorySectionCount}>{exams.length} exams</span>
            </div>
            <div className={styles.examsGrid}>
              {preview.map((exam) => (
                <ExamCard key={exam.id} exam={exam} />
              ))}
            </div>
            {remaining > 0 && (
              <button
                type="button"
                className={styles.viewAllButton}
                onClick={() => handleCategorySelect(category.categoryName)}
              >
                View all {exams.length} in {category.categoryName}
                <ArrowRight size={16} />
              </button>
            )}
          </section>
        );
      })}
    </div>
  );

  return (
    <>
      <SEOHead
        title="Browse Exams"
        description="Choose your exam from JEE, NEET, UPSC, SSC, Banking, Railway and more. Find expert-created mock tests for your preparation."
        url={CANONICAL_URL}
        image="https://assets.floot.app/0a7f01ed-7b95-4c38-9275-16e713383937/54922abf-b666-4d9f-9732-aec0c03c9254.png"
      />
      <Helmet>
        {/* Structured Data */}
        {structuredData && (
          <script type="application/ld+json">
            {JSON.stringify(structuredData)}
          </script>
        )}
      </Helmet>
      <div className={styles.pageContainer}>
        <header className={styles.hero}>
          <h1>Find Your Exam – Browse Competitive Exams by Category</h1>
          <p>
            Explore test series for any entrance exam made by top educators of
            India
          </p>
        </header>

        <div className={styles.searchBar}>
          <Search size={18} className={styles.searchIcon} />
          <Input
            type="search"
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

        {isFetching ? (
          <div className={styles.loadingContainer}>
            <div className={styles.filterNav}>
              <div className={styles.filterContainer}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton
                    key={i}
                    style={{
                      height: "36px",
                      width: `${80 + i * 20}px`,
                      borderRadius: "var(--radius-full)",
                    }}
                  />
                ))}
              </div>
            </div>
            <div className={styles.examsGrid}>
              {Array.from({ length: 30 }).map((_, i) => (
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
        ) : error ? (
          <div className={styles.errorContainer}>
            <p className={styles.errorMessage}>
              Failed to load exams. Please try again later.
            </p>
          </div>
        ) : data ? (
          <>
            <nav className={styles.filterNav}>
              <div className={styles.filterContainer}>
                <button
                  onClick={() => handleCategorySelect("All")}
                  className={`${styles.filterPill} ${
                    activeCategory === "All" ? styles.active : ""
                  }`}
                >
                  All <span className={styles.filterPillCount}>{allExams.length}</span>
                </button>
                {data.categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => handleCategorySelect(category.categoryName)}
                    className={`${styles.filterPill} ${
                      activeCategory === category.categoryName
                        ? styles.active
                        : ""
                    }`}
                  >
                    {category.categoryName}
                    <span className={styles.filterPillCount}>{category.exams.length}</span>
                  </button>
                ))}
              </div>
            </nav>

            {isSearching ? (
              <>
                <p className={styles.resultsSummary}>
                  {searchResults.length === 0
                    ? `No exams found for "${debouncedSearch}"`
                    : `${searchResults.length} exam${searchResults.length === 1 ? "" : "s"} found for "${debouncedSearch}"`}
                </p>
                {searchResults.length > 0 ? (
                  <main className={styles.examsGrid}>
                    {searchResults.map((exam) => (
                      <ExamCard key={exam.id} exam={exam} />
                    ))}
                  </main>
                ) : (
                  <div className={styles.emptyState}>
                    <p>Try a different spelling, or browse by category above.</p>
                    <button type="button" className={styles.viewAllButton} onClick={handleClearSearch}>
                      Clear search
                    </button>
                  </div>
                )}
              </>
            ) : activeCategory === "All" ? (
              renderOverview(data.categories)
            ) : (
              <>
                <div className={styles.categoryHeaderBar}>
                  <button
                    type="button"
                    className={styles.backButton}
                    onClick={() => handleCategorySelect("All")}
                  >
                    <ArrowLeft size={16} /> All Categories
                  </button>
                  <span className={styles.resultsSummary}>
                    {activeCategoryExams.length} exam{activeCategoryExams.length === 1 ? "" : "s"} in {activeCategory}
                  </span>
                </div>
                <main className={styles.examsGrid}>
                  {activeCategoryExams.map((exam) => (
                    <ExamCard key={exam.id} exam={exam} />
                  ))}
                </main>
              </>
            )}
          </>
        ) : null}
      </div>
    </>
  );
};

export default ExamsPage;
