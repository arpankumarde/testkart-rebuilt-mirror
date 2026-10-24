import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { SEOHead } from '../components/SEOHead';
import { useQuery } from '@tanstack/react-query';
import { getBundlesList } from '../endpoints/bundles/list_GET.schema';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Skeleton } from '../components/Skeleton';
import { useDebounce } from '../helpers/useDebounce';
import { Search, Tag, ArrowRight } from 'lucide-react';
import styles from './bundles.module.css';

// Lazy load the grid component
const BundlesGrid = lazy(() =>
  import('../components/BundlesGrid').then(m => ({ default: m.BundlesGrid }))
);

const BUNDLES_PER_PAGE = 9;

const BundlesGridSkeleton = () => (
  <div style={{ 
    display: 'grid', 
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
    gap: 'var(--spacing-6)',
    minHeight: '400px'
  }}>
    {Array.from({ length: 6 }).map((_, i) => (
      <Skeleton key={i} style={{ height: '400px', borderRadius: 'var(--radius-lg)' }} />
    ))}
  </div>
);

const BundlesPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlSearch = searchParams.get('search') || '';
  const [searchTerm, setSearchTerm] = useState(urlSearch);
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const page = parseInt(searchParams.get('page') || '1', 10);

  // Search lives in the URL, as on /course and /mock-test, so the search page's
  // View All lands on a filtered list. It runs on the server across every page;
  // a new term goes back to page 1.
  const setSearchParam = useCallback(
    (value: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value) next.set('search', value);
          else next.delete('search');
          next.delete('page');
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  useEffect(() => {
    if (debouncedSearchTerm !== urlSearch) setSearchParam(debouncedSearchTerm);
  }, [debouncedSearchTerm]);

  useEffect(() => {
    if (urlSearch !== debouncedSearchTerm) setSearchTerm(urlSearch);
  }, [urlSearch]);

  // Without a search the key matches pages/bundles.prefetch.ts, so the default list stays server-rendered.
  const listParams = { page, limit: BUNDLES_PER_PAGE, ...(urlSearch ? { search: urlSearch } : {}) };
  const { data, isFetching, error } = useQuery({
    queryKey: ['public', 'bundles', 'list', listParams],
    queryFn: () => getBundlesList(listParams),
    placeholderData: (previousData) => previousData,
  });

  const totalPages = data ? Math.ceil(data.total / BUNDLES_PER_PAGE) : 1;

  const handlePageChange = (newPage: number) => {
    setSearchParams(prev => {
      prev.set('page', String(newPage));
      return prev;
    });
    window.scrollTo(0, 0);
  };

  const renderContent = () => {
    if (error) {
      return (
        <div className={styles.emptyState}>
          <h2>Error Loading Bundles</h2>
          <p>There was an issue fetching the bundles. Please try again later.</p>
        </div>
      );
    }

    return (
      <BundlesGrid
        bundles={data?.bundles ?? []}
        isLoading={isFetching && !data}
      />
    );
  };

  return (
    <>
      <SEOHead
        title="Course Bundles - Save with Bundle Deals | Testkart"
        description="Explore course bundles from top teachers on Testkart. Get access to multiple courses at a discounted price and accelerate your learning journey."
        url="https://testkart.in/bundles"
      />
      <div className={styles.container}>
        <header className={styles.header}>
          <Tag size={48} className={styles.headerIcon} />
          <h1 className={styles.title}>Exam Preparation Bundles – Courses, Mock Tests & Study Material</h1>
          <p className={styles.subtitle}>Get the best value by purchasing curated collections from your favorite teachers.</p>
        </header>

        <div className={styles.controls}>
          <div className={styles.searchWrapper}>
            <Search size={18} className={styles.searchIcon} />
            <Input
              type="search"
              placeholder="Search bundles..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles.searchInput}
            />
          </div>
        </div>

        <main className={styles.mainContent}>
          <Suspense fallback={<BundlesGridSkeleton />}>
            {renderContent()}
          </Suspense>
        </main>

        {data && data.total > BUNDLES_PER_PAGE && (
          <div className={styles.pagination}>
            <Button
              variant="outline"
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1}
            >
              Previous
            </Button>
            <span>
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages}
            >
              Next
            </Button>
          </div>
        )}

        <section className={styles.ctaSection}>
          <div className={styles.ctaContent}>
            <h2>Are you a teacher?</h2>
            <p>Increase your earnings and offer more value to your students by creating your own course bundles.</p>
            <Button asChild size="lg" className={styles.ctaButton}>
              <Link to="/teacher/bundles">
                Create a Bundle <ArrowRight size={18} />
              </Link>
            </Button>
          </div>
        </section>
      </div>
    </>
  );
};

export default BundlesPage;