import React, { useState, useMemo } from 'react';
import { getItemExamNames } from '../helpers/itemExams';
import { Helmet } from 'react-helmet';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { BookCopy, Plus } from 'lucide-react';
import { useTeacherTestsQuery } from '../helpers/useTeacherTestsQuery';
import { useTeacherLiveTestsQuery } from '../helpers/useTeacherLiveTestsQuery';
import { useListUrlParams } from '../helpers/useListUrlParams';
import { useRefetchOnLinkArrival } from '../helpers/useRefetchOnLinkArrival';
import { TeacherTest } from '../endpoints/teacher/tests/list_GET.schema';
import { Button } from '../components/Button';
import { TeacherTestCard } from '../components/TeacherTestCard';
import { DeleteTestDialog } from '../components/DeleteTestDialog';
import { UnpublishTestDialog } from '../components/UnpublishTestDialog';
import { ConvertTestToDraftDialog } from '../components/ConvertTestToDraftDialog';
import { useBundleUnpublishGuard } from '../helpers/useBundleUnpublishGuard';
import { useTeacherTestMutations } from '../helpers/useTeacherTestMutations';
import { bundleCascadeNote } from '../helpers/bundleCascadeNote';
import { TeacherTestCardSkeleton } from '../components/TeacherTestCardSkeleton';
import { TeacherPageHeader } from '../components/TeacherPageHeader';
import { TeacherListEmpty } from '../components/TeacherListEmpty';
import { TeacherContentToolbar } from '../components/TeacherContentToolbar';
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

  // A series held by a published bundle gets the bundle warning in place of the
  // two dialogs above, and the unpublish runs from here once it is accepted.
  const { requestUnpublish, bundleUnpublishDialog } = useBundleUnpublishGuard();
  const { useUnpublishTestMutation } = useTeacherTestMutations();
  const unpublishMutation = useUnpublishTestMutation();

  const guardedUnpublish = (
    test: TeacherTest,
    openDialog: () => void,
    afterUnpublish?: () => void
  ) => {
    if (unpublishMutation.isPending) return;
    void requestUnpublish({ itemType: 'test', ids: [test.id] }, async (confirmedBundleUnpublish) => {
      if (!confirmedBundleUnpublish) {
        openDialog();
        return;
      }
      try {
        const result = await unpublishMutation.mutateAsync({
          testId: test.id,
          confirmBundleUnpublish: true,
        });
        toast.success(
          `"${test.title}" has been unpublished.${bundleCascadeNote(result.unpublishedBundles.length)}`
        );
        afterUnpublish?.();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'An unknown error occurred.';
        toast.error(`Failed to unpublish test: ${message}`);
        throw error;
      }
    });
  };

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
          getItemExamNames(test).some((name) => name.toLowerCase().includes(query))
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
        <div className={styles.grid} aria-busy="true" aria-label="Loading test series">
          {Array.from({ length: 6 }).map((_, index) => (
            <TeacherTestCardSkeleton key={index} />
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <TeacherListEmpty
          tone="error"
          title="Your test series could not be loaded"
          description="The list did not come back from the server. Check your connection and try again."
        >
          <Button onClick={() => refetch()}>Try again</Button>
        </TeacherListEmpty>
      );
    }

    if (!hasAnyTests) {
      return (
        <TeacherListEmpty
          kind="mock_test"
          title="No test series yet"
          description="A test series is a set of mock tests students buy as one package. Build your first one to start selling."
        >
          <Button asChild>
            <Link to="/teacher/create-test">
              <Plus size={16} />
              Create a test series
            </Link>
          </Button>
        </TeacherListEmpty>
      );
    }

    if (visibleTests.length === 0) {
      return (
        <TeacherListEmpty
          title={
            isSearching
              ? activeTab === 'all'
                ? `No test series matches "${searchQuery.trim()}"`
                : `Nothing in ${TAB_LABELS[activeTab].toLowerCase()} matches "${searchQuery.trim()}"`
              : `No ${TAB_LABELS[activeTab].toLowerCase()} test series`
          }
          description={
            isSearching
              ? activeTab === 'all'
                ? 'Try a different word.'
                : 'Try a different word, or check the other tabs.'
              : 'Nothing here yet. The other tabs may have what you are looking for.'
          }
        >
          {isSearching && (
            <Button variant="outline" onClick={() => setSearchQuery('')}>
              Clear search
            </Button>
          )}
        </TeacherListEmpty>
      );
    }

    return (
      <div className={styles.grid}>
        {visibleTests.map((test) => (
          <TeacherTestCard
            key={test.id}
            test={test}
            onDelete={() => setTestToDelete(test)}
            onUnpublish={() => guardedUnpublish(test, () => setTestToUnpublish(test))}
            onConvertToDraft={() =>
              guardedUnpublish(
                test,
                () => setTestToConvertToDraft(test),
                () => setActiveTab('draft')
              )
            }
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
        <TeacherPageHeader
          title="Test series"
          description="Create, organise and manage your mock tests in one place."
          leading={
            <span className={styles.headerIcon} aria-hidden="true">
              <BookCopy size={18} strokeWidth={2.25} />
            </span>
          }
        >
          <Link to="/teacher/create-test" className={styles.newButton}>
            <Plus size={18} strokeWidth={2.5} aria-hidden="true" />
            New test series
          </Link>
        </TeacherPageHeader>

        {hasAnyTests && (
          <TeacherContentToolbar
            tabs={TAB_ORDER.map((tab) => ({ value: tab, label: TAB_LABELS[tab], count: counts[tab] }))}
            value={activeTab}
            onValueChange={(tab) => setActiveTab(tab as StatusTab)}
            tabsLabel="Filter by status"
            search={{
              value: searchQuery,
              onChange: setSearchQuery,
              placeholder: 'Search by title or exam',
              label: 'Search test series',
            }}
            sort={{
              value: sortOption,
              onChange: setSortOption,
              label: 'Sort test series',
              options: [
                { value: 'recent', label: 'Newest first' },
                { value: 'popular', label: 'Most students' },
                { value: 'price-desc', label: 'Price: high to low' },
                { value: 'price-asc', label: 'Price: low to high' },
              ],
            }}
          />
        )}

        <div className={styles.content}>{renderContent()}</div>
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

      {bundleUnpublishDialog}
    </>
  );
};

export default TeacherTestSeriesPage;
