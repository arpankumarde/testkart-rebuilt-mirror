import React, { useState, useEffect, useId, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus,
  Pencil,
  Trash2,
  EyeOff,
  FileText,
  Upload,
  ExternalLink,
  Archive,
  Share2,
  MoreHorizontal,
  CheckCircle2,
  Clock,
  PenLine,
} from 'lucide-react';
import { useTeacherProductsQuery, useTeacherProductMutations } from '../helpers/useTeacherProductsQuery';
import { useListUrlParams } from '../helpers/useListUrlParams';
import { useRefetchOnLinkArrival } from '../helpers/useRefetchOnLinkArrival';
import { Button } from './Button';
import { Checkbox } from './Checkbox';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './Select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './Dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './DropdownMenu';
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

const priceFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
});

type RowState = 'published' | 'draft' | 'archived' | 'inReview';

// Every state is named in words with its own icon, so it never rests on
// colour alone.
const STATE_META: Record<RowState, { label: string; icon: React.ElementType; className: string }> = {
  published: { label: 'Published', icon: CheckCircle2, className: styles.statePublished },
  draft: { label: 'Draft', icon: PenLine, className: styles.stateDraft },
  archived: { label: 'Archived', icon: Archive, className: styles.stateArchived },
  inReview: { label: 'In review', icon: Clock, className: styles.stateReview },
};

// Same rule as the course card: a live product stays "Published" even while an
// edit is queued for review.
const rowStateOf = (product: TeacherProductListItem): RowState => {
  if (product.status === 'published') return 'published';
  if (product.inReview) return 'inReview';
  return product.status === 'archived' ? 'archived' : 'draft';
};

const describeProduct = (product: TeacherProductListItem) => {
  const kind = product.category || 'PDF';
  const exam = product.examName ? ` for ${product.examName}` : '';
  const pages = product.pageCount
    ? `, ${product.pageCount} ${product.pageCount === 1 ? 'page' : 'pages'}`
    : '';
  return `${kind}${exam}${pages}`;
};

/* A small A4 sheet standing in for the PDF: the cover when there is one,
   ruled lines when there is not. */
const DocSheet: React.FC<{ thumbnailUrl: string | null }> = ({ thumbnailUrl }) => (
  <span className={styles.sheet} aria-hidden="true">
    <span className={styles.sheetLine} />
    <span className={styles.sheetLine} />
    <span className={styles.sheetLine} />
    {thumbnailUrl ? (
      <img
        src={thumbnailUrl}
        alt=""
        loading="lazy"
        className={styles.sheetImage}
        onError={(event) => {
          event.currentTarget.style.display = 'none';
        }}
      />
    ) : null}
  </span>
);

interface ProductRowProps {
  product: TeacherProductListItem;
  selected: boolean;
  onToggleSelected: () => void;
  onSubmit: () => void;
  onUnpublish: () => void;
  onShare: () => void;
  onDelete: () => void;
  isSubmitting: boolean;
  isUnpublishing: boolean;
}

const ProductRow: React.FC<ProductRowProps> = ({
  product,
  selected,
  onToggleSelected,
  onSubmit,
  onUnpublish,
  onShare,
  onDelete,
  isSubmitting,
  isUnpublishing,
}) => {
  const state = rowStateOf(product);
  const meta = STATE_META[state];
  const StateIcon = meta.icon;
  const editPath = `/teacher/products/${product.id}/edit`;
  const sales = product.totalPurchases ?? 0;
  const views = product.views ?? 0;

  return (
    <li className={`${styles.row} ${selected ? styles.rowSelected : ''}`}>
      <label className={styles.selectCell}>
        <Checkbox
          checked={selected}
          onChange={onToggleSelected}
          aria-label={`Select ${product.title}`}
        />
      </label>

      <div className={styles.productCell}>
        <DocSheet thumbnailUrl={product.thumbnailUrl} />
        <div className={styles.productText}>
          <Link to={editPath} className={styles.titleLink}>
            {product.title}
          </Link>
          <span className={styles.productMeta}>{describeProduct(product)}</span>
        </div>
      </div>

      <div className={styles.statusCell}>
        <span className={`${styles.state} ${meta.className}`}>
          <StateIcon size={15} aria-hidden="true" />
          {meta.label}
        </span>
        {state === 'published' ? (
          <a
            href={buildPublicAssetUrl('study-note', product.slug)}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.nextStep}
          >
            View live page
            <span className={styles.visuallyHidden}> for {product.title} (opens in a new tab)</span>
            <ExternalLink size={13} aria-hidden="true" />
          </a>
        ) : state === 'inReview' ? (
          <span className={styles.nextNote}>Waiting for admin approval</span>
        ) : (
          <button
            type="button"
            className={styles.nextStep}
            onClick={onSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : 'Submit for review'}
            <span className={styles.visuallyHidden}>: {product.title}</span>
          </button>
        )}
      </div>

      <div className={styles.figures}>
        <span className={styles.price}>
          {product.price === 0 ? (
            <span className={styles.free}>Free</span>
          ) : (
            priceFormatter.format(product.price)
          )}
        </span>
        <span className={styles.figure}>
          {sales}
          <span className={styles.figureUnit}> {sales === 1 ? 'sale' : 'sales'}</span>
        </span>
        <span className={styles.figure}>
          {views}
          <span className={styles.figureUnit}> {views === 1 ? 'view' : 'views'}</span>
        </span>
      </div>

      <div className={styles.actionsCell}>
        <Link to={editPath} className={styles.rowButton} aria-label={`Edit ${product.title}`}>
          <Pencil size={15} aria-hidden="true" />
          Edit
        </Link>
        {/* Non-modal so the dialogs it opens do not inherit its pointer lock. */}
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={styles.iconButton}
              aria-label={`More actions for ${product.title}`}
            >
              <MoreHorizontal size={18} aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {state === 'published' && (
              <>
                <DropdownMenuItem onSelect={onShare} className={styles.menuItem}>
                  <Share2 size={16} aria-hidden="true" />
                  Share
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={onUnpublish}
                  disabled={isUnpublishing}
                  className={styles.menuItem}
                >
                  <EyeOff size={16} aria-hidden="true" />
                  Unpublish
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onSelect={onDelete} className={`${styles.menuItem} ${styles.menuDanger}`}>
              <Trash2 size={16} aria-hidden="true" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
};

export const TeacherProductManager: React.FC = () => {
  // Status lives in the URL so the dashboard's catalogue figures can land on
  // Published or Drafts. The page number stays local but is tied to the
  // filters it was set under, so changing the status, category or search
  // starts again from page 1.
  const { read, write, searchParams } = useListUrlParams();
  const statusFilter = read<StatusTab>('status', STATUS_VALUES, 'all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const searchTerm = debouncedSearch.trim();
  const filterKey = `${statusFilter}|${categoryFilter}|${searchTerm}`;
  const [pageState, setPageState] = useState({ key: filterKey, page: 1 });
  const page = pageState.key === filterKey ? pageState.page : 1;
  const setPage = (next: number) => setPageState({ key: filterKey, page: next });
  const navigate = useNavigate();
  const panelId = useId();
  const selectAllRef = useRef<HTMLInputElement>(null);

  const [deletingProduct, setDeletingProduct] = useState<TeacherProductListItem | null>(null);
  // One dialog for the whole list rather than one per row.
  const [sharingProduct, setSharingProduct] = useState<TeacherProductListItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [pendingBulkArchive, setPendingBulkArchive] = useState(false);

  const { data, isLoading, isFetching, isError, refetch } = useTeacherProductsQuery({
    page,
    limit: PRODUCTS_PER_PAGE,
    status: statusFilter === 'all' ? undefined : statusFilter,
    category: categoryFilter === 'all' ? undefined : categoryFilter,
    search: searchTerm || undefined,
  });
  useRefetchOnLinkArrival(searchParams.has('status'), isFetching, refetch);

  const {
    deleteProductMutation,
    publishProductMutation,
    unpublishProductMutation,
    bulkActionMutation,
  } = useTeacherProductMutations();

  const products = data?.products ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PRODUCTS_PER_PAGE));

  // Clear the selection whenever the page or filters change so stale ids from
  // a previous page never carry into a bulk action by accident.
  useEffect(() => {
    setSelectedIds(new Set());
  }, [page, filterKey]);

  // Deleting or archiving the last product on a later page leaves that page
  // empty; step back rather than show an empty list with products behind it.
  useEffect(() => {
    if (!isFetching && data && data.products.length === 0 && page > 1) {
      setPage(page - 1);
    }
  }, [data, isFetching, page]);

  const selectedOnPage = products.filter((p) => selectedIds.has(p.id)).length;
  const allOnPageSelected = products.length > 0 && selectedOnPage === products.length;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selectedOnPage > 0 && !allOnPageSelected;
    }
  });

  const handleCreate = () => {
    navigate('/teacher/products/create');
  };

  const confirmDelete = () => {
    if (deletingProduct) {
      deleteProductMutation.mutate(
        { id: deletingProduct.id },
        { onSuccess: () => setDeletingProduct(null) }
      );
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

  const toggleSelectAll = () => {
    if (!products.length) return;
    setSelectedIds(allOnPageSelected ? new Set() : new Set(products.map((p) => p.id)));
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

  const activeTabLabel = TABS.find((tab) => tab.value === statusFilter)?.label.toLowerCase() ?? 'all';

  const resultsMessage = isLoading || isError
    ? ''
    : searchTerm
      ? `${total} ${total === 1 ? 'product matches' : 'products match'} "${searchTerm}"`
      : `${total} ${total === 1 ? 'product' : 'products'}`;
  const liveMessage = selectedIds.size > 0 ? `${selectedIds.size} selected` : resultsMessage;

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className={styles.panel} aria-hidden="true">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className={styles.skeletonRow}>
              <Skeleton className={styles.skeletonSheet} />
              <div className={styles.skeletonText}>
                <Skeleton className={styles.skeletonTitle} />
                <Skeleton className={styles.skeletonMeta} />
              </div>
            </div>
          ))}
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

    if (products.length === 0) {
      const isEmptyOverall = !searchTerm && statusFilter === 'all' && categoryFilter === 'all';
      return (
        <TeacherListEmpty
          icon={<FileText size={26} />}
          title={
            searchTerm
              ? `No products match "${searchTerm}"`
              : isEmptyOverall
                ? 'No products yet'
                : `No ${activeTabLabel} products`
          }
          description={
            searchTerm
              ? 'Check the spelling, or search for a word from the title, category or exam.'
              : isEmptyOverall
                ? 'A digital product is a PDF students buy and download - notes, an eBook, a question bank. Upload your first one to start selling.'
                : 'Nothing here yet. The other tabs may have what you are looking for.'
          }
        >
          {searchTerm ? (
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

    const bulkPending = bulkActionMutation.isPending;

    return (
      <div className={styles.panel}>
        <div className={`${styles.listHead} ${selectedIds.size > 0 ? styles.listHeadActive : ''}`}>
          <label className={styles.selectCell}>
            <Checkbox
              ref={selectAllRef}
              checked={allOnPageSelected}
              onChange={toggleSelectAll}
              aria-label="Select all products on this page"
            />
            <span className={styles.selectAllText} aria-hidden="true">
              Select all
            </span>
          </label>
          {selectedIds.size > 0 ? (
            <div className={styles.bulkBar} role="group" aria-label="Actions for selected products">
              <span className={styles.bulkCount}>{selectedIds.size} selected</span>
              <div className={styles.bulkActions}>
                <button
                  type="button"
                  className={styles.rowButton}
                  onClick={() => runBulk('publish')}
                  disabled={bulkPending}
                >
                  <Upload size={15} aria-hidden="true" />
                  Submit for review
                </button>
                <button
                  type="button"
                  className={styles.rowButton}
                  onClick={() => runBulk('unpublish')}
                  disabled={bulkPending}
                >
                  <EyeOff size={15} aria-hidden="true" />
                  Unpublish
                </button>
                <button
                  type="button"
                  className={styles.rowButton}
                  onClick={() => setPendingBulkArchive(true)}
                  disabled={bulkPending}
                >
                  <Archive size={15} aria-hidden="true" />
                  Archive
                </button>
                <button
                  type="button"
                  className={styles.textButton}
                  onClick={() => setSelectedIds(new Set())}
                >
                  Clear selection
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.headLabels} aria-hidden="true">
              <span>Product</span>
              <span>Status</span>
              <span className={styles.headNumeric}>Price</span>
              <span className={styles.headNumeric}>Sales</span>
              <span className={styles.headNumeric}>Views</span>
            </div>
          )}
        </div>

        <ul className={styles.list} role="list" aria-label="Products">
          {products.map((product) => (
            <ProductRow
              key={product.id}
              product={product}
              selected={selectedIds.has(product.id)}
              onToggleSelected={() => toggleSelected(product.id)}
              onSubmit={() => publishProductMutation.mutate({ id: product.id })}
              onUnpublish={() => unpublishProductMutation.mutate({ id: product.id })}
              onShare={() => setSharingProduct(product)}
              onDelete={() => setDeletingProduct(product)}
              isSubmitting={
                publishProductMutation.isPending && publishProductMutation.variables?.id === product.id
              }
              isUnpublishing={
                unpublishProductMutation.isPending && unpublishProductMutation.variables?.id === product.id
              }
            />
          ))}
        </ul>
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
        panelId={panelId}
        search={{
          value: searchQuery,
          onChange: setSearchQuery,
          placeholder: 'Search by title, category or exam',
          label: 'Search products',
        }}
      >
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
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

      {/* A section, not <main>: TeacherDashboardLayout already provides the
          page's one main landmark. */}
      <section
        id={panelId}
        role="tabpanel"
        aria-labelledby={`${panelId}-tab-${statusFilter}`}
        aria-busy={isFetching}
        className={styles.content}
      >
        <p className={styles.visuallyHidden} aria-live="polite">
          {liveMessage}
        </p>
        {renderContent()}
      </section>

      {products.length > 0 && totalPages > 1 && (
        <TeacherListPagination
          page={page}
          totalPages={totalPages}
          onPageChange={(next) => setPage(Math.min(totalPages, Math.max(1, next)))}
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
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteProductMutation.isPending}
            >
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
