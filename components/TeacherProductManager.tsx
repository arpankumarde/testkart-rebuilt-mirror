import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Edit,
  Trash2,
  EyeOff,
  FileText,
  Download,
  Upload,
  Eye,
  ExternalLink,
  Archive,
  Share2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTeacherProductsQuery, useTeacherProductMutations } from '../helpers/useTeacherProductsQuery';
import { useListUrlParams } from '../helpers/useListUrlParams';
import { useRefetchOnLinkArrival } from '../helpers/useRefetchOnLinkArrival';
import { Button } from './Button';
import { Badge } from './Badge';
import { Checkbox } from './Checkbox';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './Select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './Dialog';
import { Skeleton } from './Skeleton';
import { TeacherPageHeader } from './TeacherPageHeader';
import { TeacherListToolbar, teacherToolbarControlClass } from './TeacherListToolbar';
import { TeacherListEmpty } from './TeacherListEmpty';
import { TeacherListPagination } from './TeacherListPagination';
import { ShareAssetDialog } from './ShareAssetDialog';
import { buildPublicAssetUrl, TEACHER_CONSOLE_SHARE_CAMPAIGN } from '../helpers/shareLinks';
import { useDebounce } from '../helpers/useDebounce';
import { DIGITAL_PRODUCT_CATEGORIES } from '../helpers/digitalProductRules';
import type { TeacherProductListItem } from '../endpoints/teacher/products/list_GET.schema';
import styles from './TeacherProductManager.module.css';

const PRODUCTS_PER_PAGE = 10;

type StatusTab = 'all' | 'published' | 'draft' | 'archived';

const TABS: { value: StatusTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Drafts' },
  { value: 'archived', label: 'Archived' },
];

const STATUS_VALUES = TABS.map((tab) => tab.value);

export const TeacherProductManager: React.FC = () => {
  // Status lives in the URL so the dashboard's catalogue figures can land on
  // Published or Drafts. The page number stays local but is tied to the status
  // it was set under, so any status change - a tab click or a link - starts
  // again from page 1.
  const { read, write, searchParams } = useListUrlParams();
  const statusFilter = read<StatusTab>('status', STATUS_VALUES, 'all');
  const [pageState, setPageState] = useState({ status: statusFilter, page: 1 });
  const page = pageState.status === statusFilter ? pageState.page : 1;
  const setPage = (next: number) => setPageState({ status: statusFilter, page: next });
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const navigate = useNavigate();

  const [deletingProduct, setDeletingProduct] = useState<TeacherProductListItem | null>(null);
  // One dialog for the whole table rather than one per row.
  const [sharingProduct, setSharingProduct] = useState<TeacherProductListItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [pendingBulkArchive, setPendingBulkArchive] = useState(false);

  const { data, isLoading, isFetching, isError, refetch } = useTeacherProductsQuery({
    page,
    limit: PRODUCTS_PER_PAGE,
    status: statusFilter === 'all' ? undefined : statusFilter,
    category: categoryFilter === 'all' ? undefined : categoryFilter,
  });
  useRefetchOnLinkArrival(searchParams.has('status'), isFetching, refetch);

  const {
    deleteProductMutation,
    publishProductMutation,
    unpublishProductMutation,
    bulkActionMutation,
  } = useTeacherProductMutations();

  // Clear the selection whenever the underlying page/filters change so stale
  // ids from a previous page never carry into a bulk action by accident.
  useEffect(() => {
    setSelectedIds(new Set());
  }, [page, statusFilter, categoryFilter, debouncedSearch]);

  const query = debouncedSearch.trim().toLowerCase();
  const isSearching = query.length > 0;

  // Search narrows the page already loaded - the list endpoint takes no search
  // term, so it cannot reach products on other pages. Before this the box was
  // wired to nothing at all and typing in it did nothing.
  const visibleProducts = useMemo(() => {
    const products = data?.products ?? [];
    if (!query) return products;
    return products.filter(
      (product) =>
        product.title.toLowerCase().includes(query) ||
        (product.category ?? '').toLowerCase().includes(query)
    );
  }, [data, query]);

  const handleCreate = () => {
    navigate('/teacher/products/create');
  };

  const handleEdit = (product: TeacherProductListItem) => {
    navigate(`/teacher/products/${product.id}/edit`);
  };

  const confirmDelete = () => {
    if (deletingProduct) {
      deleteProductMutation.mutate(
        { id: deletingProduct.id },
        { onSuccess: () => setDeletingProduct(null) }
      );
    }
  };

  const togglePublish = (product: TeacherProductListItem) => {
    if (product.status === 'published') {
      unpublishProductMutation.mutate({ id: product.id });
    } else {
      publishProductMutation.mutate({ id: product.id });
    }
  };

  const toggleSelected = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allOnPageSelected =
    visibleProducts.length > 0 && visibleProducts.every((p) => selectedIds.has(p.id));

  const toggleSelectAll = () => {
    if (!visibleProducts.length) return;
    setSelectedIds(() => {
      if (allOnPageSelected) return new Set();
      return new Set(visibleProducts.map((p) => p.id));
    });
  };

  const runBulk = (action: 'publish' | 'unpublish' | 'archive') => {
    if (selectedIds.size === 0) return;
    bulkActionMutation.mutate(
      { ids: Array.from(selectedIds), action },
      {
        onSuccess: () => {
          setSelectedIds(new Set());
          setPendingBulkArchive(false);
        },
      }
    );
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'published':
        return 'success' as const;
      case 'draft':
        return 'secondary' as const;
      case 'archived':
        return 'destructive' as const;
      default:
        return 'default' as const;
    }
  };

  const activeTabLabel = TABS.find((tab) => tab.value === statusFilter)?.label.toLowerCase() ?? 'all';

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className={styles.panel}>
          <div className={styles.loadingState}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className={styles.rowSkeleton} />
            ))}
          </div>
        </div>
      );
    }

    if (isError) {
      return (
        <TeacherListEmpty
          tone="error"
          title="Your products could not be loaded"
          description="The list did not come back from the server. Check your connection and try again."
        >
          <Button onClick={() => refetch()}>Try again</Button>
        </TeacherListEmpty>
      );
    }

    if (visibleProducts.length === 0) {
      const isEmptyOverall = !isSearching && statusFilter === 'all' && categoryFilter === 'all' && page === 1;
      return (
        <TeacherListEmpty
          icon={<FileText size={26} />}
          title={
            isSearching
              ? `Nothing on this page matches "${debouncedSearch.trim()}"`
              : isEmptyOverall
                ? 'No products yet'
                : `No ${activeTabLabel} products`
          }
          description={
            isSearching
              ? 'Try a different word, or check the other tabs.'
              : isEmptyOverall
                ? 'A digital product is a PDF students buy and download - notes, an eBook, a question bank. Upload your first one to start selling.'
                : 'Nothing here yet. The other tabs may have what you are looking for.'
          }
        >
          {isSearching ? (
            <Button variant="outline" onClick={() => setSearchQuery('')}>
              Clear search
            </Button>
          ) : isEmptyOverall ? (
            <Button onClick={handleCreate}>
              <Plus size={16} />
              Create a product
            </Button>
          ) : null}
        </TeacherListEmpty>
      );
    }

    return (
      <div className={styles.panel}>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.checkboxHeader}>
                  <Checkbox
                    checked={allOnPageSelected}
                    onChange={toggleSelectAll}
                    aria-label="Select all products on this page"
                  />
                </th>
                <th>Product</th>
                <th>Category</th>
                <th>Price</th>
                <th>Status</th>
                <th>Sales</th>
                <th>Views</th>
                <th className={styles.actionsHeader}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleProducts.map((product) => (
                <tr key={product.id}>
                  <td>
                    <Checkbox
                      checked={selectedIds.has(product.id)}
                      onChange={() => toggleSelected(product.id)}
                      aria-label={`Select ${product.title}`}
                    />
                  </td>
                  <td>
                    <div className={styles.productCell}>
                      <div className={styles.productIcon}>
                        <FileText size={18} />
                      </div>
                      <div className={styles.productInfo}>
                        <div className={styles.productTitleRow}>
                          <span className={styles.productTitle}>{product.title}</span>
                          {product.status === 'published' && (
                            <a
                              href={buildPublicAssetUrl('study-note', product.slug)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={styles.liveUrlIcon}
                              title="View live page"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink size={14} />
                            </a>
                          )}
                        </div>
                        <span className={styles.productMeta}>
                          {product.pageCount ? `${product.pageCount} pages` : 'PDF'}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>{product.category || '-'}</td>
                  <td className={styles.numeric}>
                    {product.price === 0 ? (
                      <span className={styles.freeTag}>Free</span>
                    ) : (
                      <span className={styles.price}>
                        {new Intl.NumberFormat('en-IN', {
                          style: 'currency',
                          currency: 'INR',
                          minimumFractionDigits: 0,
                        }).format(product.price)}
                      </span>
                    )}
                  </td>
                  <td>
                    {product.inReview ? (
                      <Badge variant="warning">in review</Badge>
                    ) : (
                      <Badge variant={getStatusBadgeVariant(product.status || 'draft')}>
                        {product.status}
                      </Badge>
                    )}
                  </td>
                  <td>
                    <div className={styles.salesCount}>
                      <Download size={14} />
                      {product.totalPurchases || 0}
                    </div>
                  </td>
                  <td>
                    <div className={styles.salesCount}>
                      <Eye size={14} />
                      {product.views ?? 0}
                    </div>
                  </td>
                  <td>
                    <div className={styles.actions}>
                      {product.status === 'published' && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setSharingProduct(product)}
                          title="Share"
                          aria-label={`Share ${product.title}`}
                        >
                          <Share2 size={16} />
                        </Button>
                      )}
                      {product.inReview ? null : product.status !== 'published' ? (
                        <Button
                          size="sm"
                          onClick={() => togglePublish(product)}
                          disabled={publishProductMutation.isPending}
                          className={styles.publishBtn}
                        >
                          <Upload size={14} /> Submit for review
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => togglePublish(product)}
                          disabled={unpublishProductMutation.isPending}
                          title="Unpublish"
                        >
                          <EyeOff size={16} />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleEdit(product)}
                        title="Edit"
                      >
                        <Edit size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className={styles.deleteBtn}
                        onClick={() => setDeletingProduct(product)}
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className={styles.page}>
      {/* Titled as the sidebar names it, so the page you land on matches the
          row you clicked. */}
      <TeacherPageHeader title="Notes & PDFs">
        <Button onClick={handleCreate}>
          <Plus size={16} />
          New product
        </Button>
      </TeacherPageHeader>

      <TeacherListToolbar
        tabs={TABS}
        value={statusFilter}
        onValueChange={(value) => {
          const next = STATUS_VALUES.find((tab) => tab === value) ?? 'all';
          write({ status: next === 'all' ? null : next });
        }}
        tabsLabel="Filter by status"
        search={{
          value: searchQuery,
          onChange: setSearchQuery,
          placeholder: 'Search by title or category',
          label: 'Search products',
        }}
      >
        <Select
          value={categoryFilter}
          onValueChange={(value) => {
            setCategoryFilter(value);
            setPage(1);
          }}
        >
          <SelectTrigger className={teacherToolbarControlClass} aria-label="Filter by category">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {DIGITAL_PRODUCT_CATEGORIES.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TeacherListToolbar>

      {selectedIds.size > 0 && (
        <div className={styles.bulkBar}>
          <span className={styles.bulkCount}>{selectedIds.size} selected</span>
          <div className={styles.bulkActions}>
            <Button
              size="sm"
              variant="outline"
              onClick={() => runBulk('publish')}
              disabled={bulkActionMutation.isPending}
            >
              <Upload size={14} /> Submit for review
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => runBulk('unpublish')}
              disabled={bulkActionMutation.isPending}
            >
              <EyeOff size={14} /> Unpublish
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPendingBulkArchive(true)}
              disabled={bulkActionMutation.isPending}
            >
              <Archive size={14} /> Archive
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
              Clear
            </Button>
          </div>
        </div>
      )}

      <main className={styles.content}>{renderContent()}</main>

      {data && data.products.length > 0 && (
        <TeacherListPagination
          page={page}
          hasNext={data.products.length >= PRODUCTS_PER_PAGE}
          onPageChange={(next) => setPage(Math.max(1, next))}
        />
      )}

      {sharingProduct && (
        <ShareAssetDialog
          open={!!sharingProduct}
          onOpenChange={(open) => !open && setSharingProduct(null)}
          kind="study-note"
          handle={sharingProduct.slug}
          campaign={TEACHER_CONSOLE_SHARE_CAMPAIGN}
          sharer="owner"
          title={sharingProduct.title}
        />
      )}

      <Dialog open={!!deletingProduct} onOpenChange={(open) => !open && setDeletingProduct(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete product</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete "{deletingProduct?.title}"? This removes
              it and its files completely - this action cannot be undone. Products with existing
              purchases can't be deleted; unpublish them instead.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingProduct(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pendingBulkArchive} onOpenChange={(open) => !open && setPendingBulkArchive(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Archive {selectedIds.size} product{selectedIds.size === 1 ? '' : 's'}
            </DialogTitle>
            <DialogDescription>
              Archived products are unpublished and hidden from your list by default. You can still
              find them under the Archived tab.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingBulkArchive(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => runBulk('archive')}
              disabled={bulkActionMutation.isPending}
            >
              Archive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
