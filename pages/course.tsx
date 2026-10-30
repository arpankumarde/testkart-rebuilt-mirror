import React, { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet";
import { SEOHead } from "../components/SEOHead";
import { Search } from "lucide-react";
import { Input } from "../components/Input";
import { useDebounce } from "../helpers/useDebounce";
import { Button } from "../components/Button";

import { usePublicCoursesQuery } from "../helpers/useStudentCoursesQuery";
import { TeacherProductCard } from "../components/HomepageContentSection";
import { Placeholder } from "../helpers/placeholderImages";
import { itemPriceProps } from "../helpers/homepageItemUtils";
import { Skeleton } from "../components/Skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/Select";
import { InputType, CourseListItem } from "../endpoints/courses/list_GET.schema";
import styles from "./course.module.css";

type SortValue = NonNullable<InputType["sortBy"]>;

const SORT_OPTIONS: { value: SortValue; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "popular", label: "Most Popular" },
];

const DEFAULT_SORT: SortValue = "popular";

const parseSort = (raw: string | null): SortValue =>
  SORT_OPTIONS.find((opt) => opt.value === raw)?.value ?? DEFAULT_SORT;

const ITEMS_PER_PAGE = 12;

const CoursesPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const sortBy = parseSort(searchParams.get("sort"));
  const urlSearch = searchParams.get("search") || "";
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState(urlSearch);
  const debouncedSearch = useDebounce(search, 300);
  const [allCourses, setAllCourses] = useState<CourseListItem[]>([]);

  // Sort and search live in the URL, as on /mock-test and /study-notes, so the
  // search page's View All lands on a filtered list that can be shared or
  // reloaded. Load More accumulates pages in memory, so page stays out of it.
  const updateParam = useCallback(
    (key: string, value: string | null) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value) next.set(key, value);
          else next.delete(key);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  // Typing reaches the URL once the debounce settles; a URL change that did
  // not come from typing (a new View All link) is copied into the box.
  useEffect(() => {
    if (debouncedSearch !== urlSearch) updateParam("search", debouncedSearch);
  }, [debouncedSearch]);

  useEffect(() => {
    if (urlSearch !== debouncedSearch) setSearch(urlSearch);
  }, [urlSearch]);

  useEffect(() => {
    setPage(1);
    setAllCourses([]);
  }, [debouncedSearch, sortBy]);

  // Query with pagination parameters
  const queryFilters = React.useMemo(
    () => ({
      sortBy,
      search: debouncedSearch || undefined,
      page: page.toString(),
      limit: ITEMS_PER_PAGE.toString(),
    }),
    [sortBy, debouncedSearch, page],
  );

  const { data, isFetching, error } = usePublicCoursesQuery(queryFilters);

  useEffect(() => {
    if (data && data.pagination.page === page) {
      setAllCourses((prev) => {
        if (page === 1) return data.courses;
        
        const existingIds = new Set(prev.map(c => c.id));
        const newCourses = data.courses.filter(c => !existingIds.has(c.id));
        return [...prev, ...newCourses];
      });
    }
  }, [data, page]);

  const handleSortChange = useCallback(
    (value: string) => {
      const next = parseSort(value);
      updateParam("sort", next === DEFAULT_SORT ? null : next);
      setPage(1);
    },
    [updateParam],
  );

  const canonicalUrl = "https://testkart.in/course";
  const pageTitle = "Online Courses | Testkart";
  const pageDescription =
    "Explore comprehensive online courses for exam preparation. Learn from expert teachers with structured curriculum and interactive content.";

  // Generate structured data
  const structuredData = React.useMemo(() => {
    const schemas: any[] = [
      // CollectionPage Schema
      {
        "@type": "CollectionPage",
        name: "Online Courses",
        description: "Browse all available online courses on Testkart",
        url: canonicalUrl,
      },
      // WebPage Schema
      {
        "@type": "WebPage",
        name: pageTitle,
        description: pageDescription,
        url: canonicalUrl,
      },
      // BreadcrumbList Schema
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: "https://testkart.in",
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Online Courses",
            item: canonicalUrl,
          },
        ],
      },
    ];

    // Add ItemList schema only when courses are available
    if (data && data.courses && data.courses.length > 0) {
      schemas.push({
        "@type": "ItemList",
        itemListElement: data.courses.map((course, index) => ({
          "@type": "ListItem",
          position: index + 1,
          url: `https://testkart.in/course/${course.slug}`,
          name: course.title,
          description: course.description || course.title,
        })),
      });
    }

    return {
      "@context": "https://schema.org",
      "@graph": schemas,
    };
  }, [data]);

  const renderContent = () => {
    if (isFetching && page === 1) {
      return Array.from({ length: 6 }).map((_, index) => (
        <div key={index} style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-3)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "var(--spacing-4)" }}>
          <div style={{ display: "flex", gap: "var(--spacing-3)", alignItems: "center" }}>
            <Skeleton style={{ width: 36, height: 36, borderRadius: "50%" }} />
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-1)", flex: 1 }}>
              <Skeleton style={{ height: 14, width: 100 }} />
              <Skeleton style={{ height: 12, width: 150 }} />
            </div>
          </div>
          <Skeleton style={{ height: 20, width: "100%", marginTop: "var(--spacing-2)" }} />
          <Skeleton style={{ width: "100%", aspectRatio: "16/9", borderRadius: "var(--radius)" }} />
        </div>
      ));
    }

    if (error && page === 1) {
      return (
        <div className={styles.stateContainer}>
          <p className={styles.errorText}>
            Failed to load courses. Please try again later.
          </p>
        </div>
      );
    }

    if (!isFetching && allCourses.length === 0) {
      return (
        <div className={styles.stateContainer}>
          {debouncedSearch ? (
            <p>No courses match "{debouncedSearch}". Try a different search.</p>
          ) : (
            <>
              <p>No courses are available at the moment.</p>
              <p>Please check back later!</p>
            </>
          )}
        </div>
      );
    }

    return (
      <>
        {allCourses.map((course) => (
          <TeacherProductCard
            key={course.id}
            link={"/course/" + course.slug}
            teacherName={course.teacherName}
            teacherAvatarUrl={course.teacherAvatarUrl}
            teacherTagline={course.teacherTagline}
            teacherYearsOfExperience={course.teacherYearsOfExperience}
            teacherSlug={course.teacherSlug}
            teacherIsVerified={course.teacherIsVerified}
            productTitle={course.title}
            {...itemPriceProps(course.price, course.discountPrice, course.couponOffer ?? null)}
            thumbnailUrl={course.thumbnailImageUrl || course.thumbnailUrl}
            placeholderUrl={Placeholder.COURSE}
          />
        ))}
        {data && data.pagination.page < data.pagination.totalPages && (
          <div className={styles.loadMoreContainer}>
            <p className={styles.loadMoreInfo}>
              Showing {allCourses.length} of {data.pagination.totalCount}
            </p>
            <Button
              onClick={() => setPage((p) => p + 1)}
              disabled={isFetching}
              variant="outline"
            >
              {isFetching ? "Loading..." : "Load More"}
            </Button>
          </div>
        )}
      </>
    );
  };

  return (
    <>
      <SEOHead
        title={pageTitle}
        description={pageDescription}
        url={canonicalUrl}
      />
      <Helmet>
        {/* Structured Data (JSON-LD) */}
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      </Helmet>
      <div className={styles.pageContainer}>
        <header className={styles.pageHeader}>
          <h1>Online Courses – Live & Recorded Classes for Competitive Exams</h1>
          <p>
            Master new skills with comprehensive courses designed by expert educators.
          </p>
        </header>

        <main className={styles.mainContent}>
          <div className={styles.coursesSection}>
            <div className={styles.sortBar}>
              <p className={styles.resultsCount}>
                {isFetching && page === 1 ? (
                  <Skeleton style={{ width: "100px", height: "20px" }} />
                ) : (
                  <>Found <strong>{data?.pagination.totalCount || 0}</strong> courses</>
                )}
              </p>
              <div className={styles.searchContainer}>
                <Search className={styles.searchIcon} size={18} />
                <Input
                  type="search"
                  placeholder="Search courses..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={styles.searchInput}
                />
              </div>
              <div className={styles.sortControls}>
                <label className={styles.sortLabel}>Sort by:</label>
                <Select
                  value={sortBy}
                  onValueChange={handleSortChange}
                >
                  <SelectTrigger className={styles.sortTrigger}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className={styles.coursesGrid}>{renderContent()}</div>
          </div>
        </main>
      </div>
    </>
  );
};

export default CoursesPage;