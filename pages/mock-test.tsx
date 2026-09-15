import React, { useState, useCallback, useEffect } from "react";
import { Helmet } from "react-helmet";
import { SEOHead } from "../components/SEOHead";
import { Button } from "../components/Button";

import { useTestsQuery } from "../helpers/useTestsQuery";
import { TeacherProductCard } from "../components/HomepageContentSection";
import { Placeholder } from "../helpers/placeholderImages";
import { formatItemPrice } from "../helpers/homepageItemUtils";
import { Skeleton } from "../components/Skeleton";
import { Search } from "lucide-react";
import { Input } from "../components/Input";
import { useDebounce } from "../helpers/useDebounce";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/Select";
import { InputType, TestListItem } from "../endpoints/tests/list_GET.schema";
import styles from "./mock-test.module.css";

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "popular", label: "Most Popular" },
  { value: "rating", label: "Highest Rated" },
];

const ITEMS_PER_PAGE = 12;

const OnlineMockTestsPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [filters, setFilters] = useState<InputType>({
    sortBy: "popular",
  });
  const [allTests, setAllTests] = useState<TestListItem[]>([]);

  useEffect(() => {
    setPage(1);
    setAllTests([]);
  }, [debouncedSearch]);

  // Query with pagination parameters
  const queryFilters = React.useMemo(
    () => ({
      ...filters,
      search: debouncedSearch || undefined,
      page: page.toString(),
      limit: ITEMS_PER_PAGE.toString(),
    }),
    [filters, debouncedSearch, page],
  );

  const { data, isFetching, error } = useTestsQuery(queryFilters);

  useEffect(() => {
    if (data && data.pagination.page === page) {
      setAllTests((prev) => {
        if (page === 1) return data.tests;
        
        const existingIds = new Set(prev.map(t => t.id));
        const newTests = data.tests.filter(t => !existingIds.has(t.id));
        return [...prev, ...newTests];
      });
    }
  }, [data, page]);

  const handleSortChange = useCallback((sortBy: string) => {
    setFilters((prev) => ({ ...prev, sortBy: sortBy as InputType["sortBy"] }));
    setPage(1); // Reset to first page when sort changes
    setAllTests([]);
  }, []);

  const canonicalUrl = "https://testkart.in/mock-test";
  const pageTitle = "Online Mock Tests | Testkart";
  const pageDescription =
    "Explore comprehensive online mock tests for SSC, Banking, Railways, UPSC, and more. Practice with expert-created test series to ace your competitive exams. Start your preparation today on Testkart.";

  // Generate structured data
  const structuredData = React.useMemo(() => {
    const schemas: any[] = [
      // CollectionPage Schema
      {
        "@type": "CollectionPage",
        name: "Online Mock Tests",
        description: "Browse all available mock tests on Testkart",
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
            name: "Online Mock Tests",
            item: canonicalUrl,
          },
        ],
      },
    ];

    // Add ItemList schema only when tests are available
    if (data && data.tests && data.tests.length > 0) {
      schemas.push({
        "@type": "ItemList",
        itemListElement: data.tests.map((test, index) => ({
          "@type": "ListItem",
          position: index + 1,
          url: `https://testkart.in/mock-test/${test.slug}`,
          name: test.title,
          description: test.description || test.title,
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
            Failed to load tests. Please try again later.
          </p>
        </div>
      );
    }

    if (!isFetching && allTests.length === 0) {
      return (
        <div className={styles.stateContainer}>
          <p>No mock tests are available at the moment.</p>
          <p>Please check back later!</p>
        </div>
      );
    }

    return (
      <>
        {allTests.map((test) => (
          <TeacherProductCard
            key={test.id}
            link={"/mock-test/" + test.slug}
            teacherName={test.teacherName}
            teacherAvatarUrl={test.teacherAvatarUrl}
            teacherTagline={test.teacherTagline}
            teacherYearsOfExperience={test.teacherYearsOfExperience}
            teacherSlug={test.teacherSlug}
            teacherIsVerified={test.teacherIsVerified}
            productTitle={test.title}
            examName={test.examName}
            stats={`${test.views.toLocaleString('en-IN')} views${test.rating ? ` · ⭐ ${test.rating}` : ''}`}
            priceLabel={formatItemPrice(test.price, test.discountPrice)}
            isFree={(test.discountPrice ?? test.price) === 0}
            thumbnailUrl={test.thumbnailUrl}
            placeholderUrl={Placeholder.TEST}
          />
        ))}
        {data && data.pagination.page < data.pagination.totalPages && (
          <div className={styles.loadMoreContainer}>
            <p className={styles.loadMoreInfo}>
              Showing {allTests.length} of {data.pagination.totalCount}
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
        title="Browse Online Mock Tests"
        description="Discover thousands of expert-created mock tests for JEE, NEET, UPSC, SSC, Banking exams and more. Practice with instant results and improve your performance."
        url={canonicalUrl}
        image="https://assets.floot.app/0a7f01ed-7b95-4c38-9275-16e713383937/54922abf-b666-4d9f-9732-aec0c03c9254.png"
      />
      <Helmet>
        {/* Structured Data (JSON-LD) */}
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      </Helmet>
      <div className={styles.pageContainer}>
        <header className={styles.pageHeader}>
          <h1>Online Mock Tests – Practice Tests for JEE, NEET, UPSC, SSC & Banking</h1>
          <p>
            Find the perfect mock test to sharpen your skills and boost your
            confidence.
          </p>
        </header>

        <main className={styles.mainContent}>
          <div className={styles.testsSection}>
            <div className={styles.sortBar}>
              <p className={styles.resultsCount}>
                {isFetching && page === 1 ? (
                  <Skeleton style={{ width: "100px", height: "20px" }} />
                ) : (
                  <>Found <strong>{data?.pagination.totalCount || 0}</strong> tests</>
                )}
              </p>
              <div className={styles.searchContainer}>
                <Search className={styles.searchIcon} size={18} />
                <Input
                  type="search"
                  placeholder="Search by title..."
                  className={styles.searchInput}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className={styles.sortControls}>
                <label className={styles.sortLabel}>Sort by:</label>
                <Select
                  value={filters.sortBy || "popular"}
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
            <div className={styles.testsGrid}>{renderContent()}</div>
          </div>
        </main>
      </div>
    </>
  );
};

export default OnlineMockTestsPage;
