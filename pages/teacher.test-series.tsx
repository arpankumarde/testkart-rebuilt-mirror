import React, { useState, useMemo } from 'react';
import { getItemExamNames } from '../helpers/itemExams';
import { Helmet } from 'react-helmet';
import { toast } from 'sonner';
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
import { TeacherListEmpty } from '../components/TeacherListEmpty';
import { TeacherContentPage } from '../components/TeacherContentPage';
import { TeacherContentEmpty } from '../components/TeacherContentEmpty';
import {
  withStatusCounts,
  teacherListStatus,
  TEACHER_STATUS_TABS as TABS,
  TEACHER_STATUS_TAB_VALUES as TAB_ORDER,
  type TeacherListStatus,
  type TeacherListTab as StatusTab,
} from '../components/TeacherStatusTabs';
import styles from './teacher.test-series.module.css';

const DEFAULT_TAB: StatusTab = 'all';

const CREATE = { label: 'New test series', to: '/teacher/create-test' };

const statusOf = (test: TeacherTest): TeacherListStatus => teacherListStatus(test.isPublished, test.wasEverPublished);

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

  // Unknown until the list arrives, so the tabs stay hidden rather than flash.
  const total = tests ? ownTests.length : undefined;
  const query = searchQuery.trim();
  const statusWord = TABS.find((tab) => tab.value === activeTab)?.word || undefined;

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

    if (!total) {
      return (
        <TeacherContentEmpty
          kind="mock_test"
          plural="test series"
          reason="none"
          description="A test series is a set of mock tests students buy as one package. Build your first one to start selling."
          create={{ ...CREATE, label: 'Create a test series' }}
        />
      );
    }

    if (visibleTests.length === 0) {
      return query ? (
        <TeacherContentEmpty
          kind="mock_test"
          plural="test series"
          reason="search"
          query={query}
          statusWord={statusWord}
          onClearSearch={() => setSearchQuery('')}
        />
      ) : (
        <TeacherContentEmpty
          kind="mock_test"
          plural="test series"
          reason="status"
          statusWord={statusWord ?? ''}
        />
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
                () => setActiveTab('unpublished')
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
      <TeacherContentPage
        kind="mock_test"
        title="Test series"
        description="Create, organise and manage your mock tests in one place."
        create={CREATE}
        busy={isFetching}
        toolbar={{
          tabs: {
            tabs: withStatusCounts(TABS, counts),
            value: activeTab,
            onValueChange: setActiveTab,
            total,
          },
          search: {
            value: searchQuery,
            onChange: setSearchQuery,
            placeholder: 'Search by title or exam',
            label: 'Search test series',
          },
          selects: [
            {
              value: sortOption,
              onChange: setSortOption,
              label: 'Sort test series',
              options: [
                { value: 'recent', label: 'Newest first' },
                { value: 'popular', label: 'Most students' },
                { value: 'price-desc', label: 'Price: high to low' },
                { value: 'price-asc', label: 'Price: low to high' },
              ],
            },
          ],
        }}
      >
        {renderContent()}
      </TeacherContentPage>

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
          onConverted={() => setActiveTab('unpublished')}
        />
      )}

      {bundleUnpublishDialog}
    </>
  );
};

export default TeacherTestSeriesPage;
