import React, { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { Plus, Search, ListChecks } from 'lucide-react';
import { useTeacherTestsQuery } from '../helpers/useTeacherTestsQuery';
import { useTeacherLiveTestsQuery } from '../helpers/useTeacherLiveTestsQuery';
import { useListUrlParams } from '../helpers/useListUrlParams';
import { useRefetchOnLinkArrival } from '../helpers/useRefetchOnLinkArrival';
import { TeacherTest } from '../endpoints/teacher/tests/list_GET.schema';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/Select';
import { TeacherTestCard } from '../components/TeacherTestCard';
import { DeleteTestDialog } from '../components/DeleteTestDialog';
import { UnpublishTestDialog } from '../components/UnpublishTestDialog';
import { ConvertTestToDraftDialog } from '../components/ConvertTestToDraftDialog';
import { TestCardSkeleton } from '../components/TestCardSkeleton';
import styles from './teacher.test-series.module.css';

type TestStatus = 'published' | 'draft' | 'unpublished';
type StatusTab = 'all' | TestStatus;

const TAB_LABELS: Record<StatusTab, string> = {
  all: 'All',
  published: 'Published',
  draft: 'Drafts',
  unpublished: 'Unpublished',
};

const TAB_ORDER: StatusTab[] = ['all', 'published', 'draft', 'unpublished'];

const DEFAULT_TAB: StatusTab = 'all';

const statusOf = (test: TeacherTest): TestStatus =>
  test.isPublished ? 'published' : test.wasEverPublished ? 'unpublished' : 'draft';

const TeacherTestSeriesPage: React.FC = () => {
  const { data: tests, isFetching, error, refetch } = useTeacherTestsQuery();
  // Only the id list is needed, and the endpoint returns all of it on any
  // page, so one test is enough. The default page of 10 missed older live
  // tests, whose mock tests then showed up under Drafts.
  const { data: liveTestsData } = useTeacherLiveTestsQuery({ limit: 1 });
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState('recent');
  const [testToDelete, setTestToDelete] = useState<TeacherTest | null>(null);
  const [testToUnpublish, setTestToUnpublish] = useState<TeacherTest | null>(null);
  const [testToConvertToDraft, setTestToConvertToDraft] = useState<TeacherTest | null>(null);

  // The tab lives in the URL so other screens can land the teacher on a
  // specific one - publishing sends them straight to ?status=published, and
  // the dashboard's catalogue figures link to Published and Drafts.
  const { read, write, searchParams } = useListUrlParams();
  const activeTab = read<StatusTab>('status', TAB_ORDER, DEFAULT_TAB);
  useRefetchOnLinkArrival(searchParams.has('status'), isFetching, refetch);

  const setActiveTab = (tab: StatusTab) => {
    write({ status: tab === DEFAULT_TAB ? null : tab });
  };

  // A mock test powering a live test is managed from Live Tests, not here. The
  // dashboard's test series counts leave out the same set.
  const liveTestMockTestIds = useMemo(() => {
    return new Set<number>(liveTestsData?.mockTestIds ?? []);
  }, [liveTestsData]);

  const ownTests = useMemo(
    () => (tests ?? []).filter((test) => !liveTestMockTestIds.has(test.id)),
    [tests, liveTestMockTestIds]
  );

  const counts = useMemo(() => {
    const base: Record<StatusTab, number> = { all: ownTests.length, published: 0, draft: 0, unpublished: 0 };
    for (const test of ownTests) base[statusOf(test)] += 1;
    return base;
  }, [ownTests]);

  const visibleTests = useMemo(() => {
    let filtered =
      activeTab === 'all' ? ownTests : ownTests.filter((test) => statusOf(test) === activeTab);

    const query = searchQuery.trim().toLowerCase();
    if (query) {
      filtered = filtered.filter(
        (test) =>
          test.title.toLowerCase().includes(query) ||
          (test.examName ?? '').toLowerCase().includes(query)
      );
    }

    return [...filtered].sort((a, b) => {
      switch (sortOption) {
        case 'popular':
          return b.studentsEnrolled - a.studentsEnrolled;
        case 'price-desc':
          return b.price - a.price;
        case 'price-asc':
          return a.price - b.price;
        case 'recent':
        default: {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        }
      }
    });
  }, [ownTests, activeTab, searchQuery, sortOption]);

  const hasAnyTests = ownTests.length > 0;
  const isSearching = searchQuery.trim().length > 0;

  const renderContent = () => {
    if (isFetching && !tests) {
      return (
        <div className={styles.grid}>
          {Array.from({ length: 6 }).map((_, index) => (
            <TestCardSkeleton key={index} />
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <div className={styles.empty} role="alert">
          <h2 className={styles.emptyTitle}>Your test series could not be loaded</h2>
          <p className={styles.emptyText}>
            The list did not come back from the server. Check your connection and try again.
          </p>
          <Button onClick={() => refetch()}>Try again</Button>
        </div>
      );
    }

    if (!hasAnyTests) {
      return (
        <div className={styles.empty}>
          <span className={styles.emptyIcon} aria-hidden="true">
            <ListChecks size={26} />
          </span>
          <h2 className={styles.emptyTitle}>No test series yet</h2>
          <p className={styles.emptyText}>
            A test series is a set of mock tests students buy as one package. Build your first one to
            start selling.
          </p>
          <Button asChild>
            <Link to="/teacher/create-test">
              <Plus size={16} />
              Create a test series
            </Link>
          </Button>
        </div>
      );
    }

    if (visibleTests.length === 0) {
      return (
        <div className={styles.empty}>
          <h2 className={styles.emptyTitle}>
            {isSearching
              ? activeTab === 'all'
                ? `No test series matches "${searchQuery.trim()}"`
                : `Nothing in ${TAB_LABELS[activeTab].toLowerCase()} matches "${searchQuery.trim()}"`
              : `No ${TAB_LABELS[activeTab].toLowerCase()} test series`}
          </h2>
          <p className={styles.emptyText}>
            {isSearching
              ? activeTab === 'all'
                ? 'Try a different word.'
                : 'Try a different word, or check the other tabs.'
              : 'Nothing here yet. The other tabs may have what you are looking for.'}
          </p>
          {isSearching && (
            <Button variant="outline" onClick={() => setSearchQuery('')}>
              Clear search
            </Button>
          )}
        </div>
      );
    }

    return (
      <div className={styles.grid}>
        {visibleTests.map((test) => (
          <TeacherTestCard
            key={test.id}
            test={test}
            onDelete={() => setTestToDelete(test)}
            onUnpublish={() => setTestToUnpublish(test)}
            onConvertToDraft={() => setTestToConvertToDraft(test)}
          />
        ))}
      </div>
    );
  };

  return (
    <>
      <Helmet>
        <title>Test series - Testkart for Teachers</title>
        <meta name="description" content="Manage your mock test series on Testkart." />
      </Helmet>
      <div className={styles.page}>
        <header className={styles.header}>
          <h1 className={styles.title}>Test series</h1>
          <Button asChild>
            <Link to="/teacher/create-test">
              <Plus size={16} />
              New test series
            </Link>
          </Button>
        </header>

        {hasAnyTests && (
          <div className={styles.toolbar}>
            <div className={styles.tabs} role="tablist" aria-label="Filter by status">
              {TAB_ORDER.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab}
                  className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {TAB_LABELS[tab]}
                  <span className={styles.tabCount}>{counts[tab]}</span>
                </button>
              ))}
            </div>

            <div className={styles.filters}>
              <div className={styles.searchWrapper}>
                <Search size={16} className={styles.searchIcon} aria-hidden="true" />
                <Input
                  type="search"
                  placeholder="Search by title or exam"
                  aria-label="Search test series"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={styles.searchInput}
                />
              </div>
              <Select value={sortOption} onValueChange={setSortOption}>
                <SelectTrigger className={styles.sort} aria-label="Sort test series">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Newest first</SelectItem>
                  <SelectItem value="popular">Most students</SelectItem>
                  <SelectItem value="price-desc">Price: high to low</SelectItem>
                  <SelectItem value="price-asc">Price: low to high</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <main className={styles.content}>{renderContent()}</main>
      </div>

      {testToDelete && (
        <DeleteTestDialog
          test={testToDelete}
          isOpen={!!testToDelete}
          onClose={() => setTestToDelete(null)}
        />
      )}

      {testToUnpublish && (
        <UnpublishTestDialog
          test={testToUnpublish}
          isOpen={!!testToUnpublish}
          onClose={() => setTestToUnpublish(null)}
        />
      )}

      {testToConvertToDraft && (
        <ConvertTestToDraftDialog
          test={testToConvertToDraft}
          isOpen={!!testToConvertToDraft}
          onClose={() => setTestToConvertToDraft(null)}
          onConverted={() => setActiveTab('draft')}
        />
      )}
    </>
  );
};

export default TeacherTestSeriesPage;
