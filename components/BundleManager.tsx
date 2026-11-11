import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTeacherBundlesQuery } from '../helpers/useTeacherBundlesQuery';
import { useBundleMutations } from '../helpers/useBundleMutations';
import { useListUrlParams } from '../helpers/useListUrlParams';
import { useRefetchOnLinkArrival } from '../helpers/useRefetchOnLinkArrival';
import { BundleCard } from './BundleCard';
import { Button } from './Button';
import { TeacherListEmpty } from './TeacherListEmpty';
import { TeacherListPagination } from './TeacherListPagination';
import { TeacherContentPage } from './TeacherContentPage';
import { TeacherContentEmpty } from './TeacherContentEmpty';
import { withStatusCounts, type TeacherStatusTabDef } from './TeacherStatusTabs';
import { TestCardSkeleton } from './TestCardSkeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './Dialog';
import type { BundleListItem } from '../endpoints/teacher/bundles/list_GET.schema';
import styles from './BundleManager.module.css';

const BUNDLES_PER_PAGE = 9;

type StatusTab = 'all' | 'published' | 'draft';

const TABS: TeacherStatusTabDef<StatusTab>[] = [
  { value: 'all', label: 'All', word: '' },
  { value: 'published', label: 'Published', word: 'published' },
  { value: 'draft', label: 'Drafts', word: 'draft' },
];

const STATUS_VALUES = TABS.map((tab) => tab.value);

export const BundleManager: React.FC = () => {
  const navigate = useNavigate();
  const { read, readId, write } = useListUrlParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [bundleToDelete, setBundleToDelete] = useState<BundleListItem | null>(null);

  const page = readId('page') ?? 1;
  const status = read<StatusTab>('status', STATUS_VALUES, 'all');
  const query = searchTerm.trim();

  const { data, isFetching, error, refetch } = useTeacherBundlesQuery({
    page: String(page),
    limit: String(BUNDLES_PER_PAGE),
    status: status === 'all' ? undefined : status,
    search: query || undefined,
  });
  useRefetchOnLinkArrival(status !== 'all', isFetching, refetch);

  const { deleteBundleMutation, publishBundleMutation } = useBundleMutations();

  const handleTabChange = (next: StatusTab) => {
    write({ status: next === 'all' ? null : next, page: null });
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    write({ page: null });
  };

  const handlePageChange = (newPage: number) => {
    write({ page: newPage > 1 ? newPage : null });
  };

  const handleEdit = (bundle: BundleListItem) => {
    navigate(`/teacher/bundles/${bundle.id}/edit`);
  };

  const confirmDelete = () => {
    if (!bundleToDelete) return;
    deleteBundleMutation.mutate(
      { bundleId: bundleToDelete.id },
      { onSuccess: () => setBundleToDelete(null) }
    );
  };

  const handlePublishToggle = (bundle: BundleListItem) => {
    publishBundleMutation.mutate({
      bundleId: bundle.id,
      publish: !bundle.isPublished,
    });
  };

  const bundles = data?.bundles ?? [];
  const total = data?.statusCounts.all;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / BUNDLES_PER_PAGE)) : 1;
  const statusWord = TABS.find((tab) => tab.value === status)?.word || undefined;

  const renderContent = () => {
    if (isFetching && !data) {
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
        <TeacherListEmpty
          tone="error"
          title="Your bundles could not be loaded"
          description={error.message || 'The list did not come back from the server. Try again in a moment.'}
        >
          <Button onClick={() => refetch()}>Try again</Button>
        </TeacherListEmpty>
      );
    }

    if (!total) {
      return (
        <TeacherContentEmpty
          kind="bundle"
          plural="bundles"
          reason="none"
          description="A bundle sells several of your courses, tests and notes together at one price. Build your first one to start selling."
          create={{ label: 'Create a bundle', to: '/teacher/bundles/create' }}
        />
      );
    }

    if (bundles.length === 0) {
      return query ? (
        <TeacherContentEmpty
          kind="bundle"
          plural="bundles"
          reason="search"
          query={query}
          statusWord={statusWord}
          onClearSearch={() => handleSearchChange('')}
        />
      ) : (
        <TeacherContentEmpty kind="bundle" plural="bundles" reason="status" statusWord={statusWord ?? ''} />
      );
    }

    return (
      <div className={styles.grid}>
        {bundles.map((bundle) => (
          <BundleCard
            key={bundle.id}
            bundle={bundle}
            onEdit={() => handleEdit(bundle)}
            onDelete={() => setBundleToDelete(bundle)}
            onPublishToggle={() => handlePublishToggle(bundle)}
          />
        ))}
      </div>
    );
  };

  return (
    <>
      <TeacherContentPage
        kind="bundle"
        title="Bundles"
        description="Sell several of your published items together at one price."
        create={{ label: 'New bundle', to: '/teacher/bundles/create' }}
        busy={isFetching}
        toolbar={{
          tabs: {
            tabs: withStatusCounts(TABS, data?.statusCounts),
            value: status,
            onValueChange: handleTabChange,
            total,
          },
          search: {
            value: searchTerm,
            onChange: handleSearchChange,
            placeholder: 'Search by title',
            label: 'Search bundles',
          },
        }}
        footer={
          data &&
          data.total > BUNDLES_PER_PAGE && (
            <TeacherListPagination page={page} totalPages={totalPages} onPageChange={handlePageChange} />
          )
        }
      >
        {renderContent()}
      </TeacherContentPage>

      <Dialog
        open={!!bundleToDelete}
        onOpenChange={(open) => !open && setBundleToDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete bundle</DialogTitle>
            <DialogDescription>
              "{bundleToDelete?.title}" will be removed permanently. The items inside it are
              not affected. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBundleToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteBundleMutation.isPending}
            >
              {deleteBundleMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
