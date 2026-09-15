import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Package } from 'lucide-react';
import { useTeacherBundlesQuery } from '../helpers/useTeacherBundlesQuery';
import { useBundleMutations } from '../helpers/useBundleMutations';
import { useListUrlParams } from '../helpers/useListUrlParams';
import { useRefetchOnLinkArrival } from '../helpers/useRefetchOnLinkArrival';
import { BundleCard } from './BundleCard';
import { Button } from './Button';
import { TeacherPageHeader } from './TeacherPageHeader';
import { TeacherListToolbar } from './TeacherListToolbar';
import { TeacherListEmpty } from './TeacherListEmpty';
import { TeacherListPagination } from './TeacherListPagination';
import { TestCardSkeleton } from './TestCardSkeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './Dialog';
import { useDebounce } from '../helpers/useDebounce';
import type { BundleListItem } from '../endpoints/teacher/bundles/list_GET.schema';
import styles from './BundleManager.module.css';

const BUNDLES_PER_PAGE = 9;

type StatusTab = 'all' | 'published' | 'draft';

const TABS: { value: StatusTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Drafts' },
];

const STATUS_VALUES = TABS.map((tab) => tab.value);

export const BundleManager: React.FC = () => {
  const navigate = useNavigate();
  const { read, readId, write } = useListUrlParams();
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [bundleToDelete, setBundleToDelete] = useState<BundleListItem | null>(null);

  const page = readId('page') ?? 1;
  const status = read<StatusTab>('status', STATUS_VALUES, 'all');

  const { data, isFetching, error, refetch } = useTeacherBundlesQuery({
    page: String(page),
    limit: String(BUNDLES_PER_PAGE),
    status: status === 'all' ? undefined : status,
  });
  useRefetchOnLinkArrival(status !== 'all', isFetching, refetch);

  const { deleteBundleMutation, publishBundleMutation } = useBundleMutations();

  const handleTabChange = (value: string) => {
    const next = STATUS_VALUES.find((tab) => tab === value) ?? 'all';
    write({ status: next === 'all' ? null : next, page: null });
  };

  const handlePageChange = (newPage: number) => {
    write({ page: newPage > 1 ? newPage : null });
  };

  const handleCreate = () => {
    navigate('/teacher/bundles/create');
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

  const query = debouncedSearchTerm.trim().toLowerCase();
  const isSearching = query.length > 0;

  // Search narrows the page already loaded - the list endpoint takes no search
  // term, so it cannot reach bundles on other pages.
  const visibleBundles = data?.bundles.filter((bundle) =>
    bundle.title.toLowerCase().includes(query)
  );

  const totalPages = data ? Math.max(1, Math.ceil(data.total / BUNDLES_PER_PAGE)) : 1;
  const activeTabLabel = TABS.find((tab) => tab.value === status)?.label.toLowerCase() ?? 'all';

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

    if (!visibleBundles || visibleBundles.length === 0) {
      const isEmptyOverall = !isSearching && status === 'all' && page === 1;
      return (
        <TeacherListEmpty
          icon={<Package size={26} />}
          title={
            isSearching
              ? `Nothing on this page matches "${debouncedSearchTerm.trim()}"`
              : isEmptyOverall
                ? 'No bundles yet'
                : `No ${activeTabLabel} bundles`
          }
          description={
            isSearching
              ? 'Try a different word, or check the other tabs.'
              : isEmptyOverall
                ? 'A bundle sells several of your courses, tests and notes together at one price. Build your first one to start selling.'
                : 'Nothing here yet. The other tabs may have what you are looking for.'
          }
        >
          {isSearching ? (
            <Button variant="outline" onClick={() => setSearchTerm('')}>
              Clear search
            </Button>
          ) : isEmptyOverall ? (
            <Button onClick={handleCreate}>
              <Plus size={16} />
              Create a bundle
            </Button>
          ) : null}
        </TeacherListEmpty>
      );
    }

    return (
      <div className={styles.grid}>
        {visibleBundles.map((bundle) => (
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
    <div className={styles.page}>
      <TeacherPageHeader title="Bundles">
        <Button onClick={handleCreate}>
          <Plus size={16} />
          New bundle
        </Button>
      </TeacherPageHeader>

      <TeacherListToolbar
        tabs={TABS}
        value={status}
        onValueChange={handleTabChange}
        tabsLabel="Filter by status"
        search={{
          value: searchTerm,
          onChange: setSearchTerm,
          placeholder: 'Search by title',
          label: 'Search bundles',
        }}
      />

      <main className={styles.content}>{renderContent()}</main>

      {data && data.total > BUNDLES_PER_PAGE && (
        <TeacherListPagination
          page={page}
          totalPages={totalPages}
          onPageChange={handlePageChange}
        />
      )}

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
    </div>
  );
};
