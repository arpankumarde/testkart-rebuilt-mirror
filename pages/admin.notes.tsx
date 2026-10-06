import React, { useState, useMemo, useEffect, useRef } from "react";
import { Helmet } from "react-helmet";
import { useAdminNotesPageQuery, useDeactivateProductMutation } from "../helpers/useAdminProducts";
import { useListUrlParams } from "../helpers/useListUrlParams";
import { useRefetchOnLinkArrival } from "../helpers/useRefetchOnLinkArrival";
import { useServerTableSort, SortOrder } from "../helpers/useTableSort";
import { useListPage } from "../helpers/useListPage";
import { SortableTh } from "../components/SortableTh";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { Badge } from "../components/Badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/Tooltip";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { ConsoleListToolbar } from "../components/ConsoleListToolbar";
import { ConsoleListEmpty } from "../components/ConsoleListEmpty";
import { ConsoleFilterNotice } from "../components/ConsoleFilterNotice";
import { ConsoleConfirmDialog } from "../components/ConsoleConfirmDialog";
import { ConsoleListPagination } from "../components/ConsoleListPagination";
import {
  CheckCircle2,
  FileText,
  AlertTriangle,
  ArchiveRestore,
  Archive,
  Files,
  ShoppingCart,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { DigitalProductStatus } from "../helpers/schema";
import { AdminNotesPageItem, NotesSortColumn } from "../endpoints/admin/products/page_GET.schema";
import { AdminProductDetailPanel } from "../components/AdminProductDetailPanel";
import { adminPreviewPath } from "../helpers/useAdminContentPreview";
import { adminEditPath } from "../helpers/adminContentEdit";
import { AdminEditIconButton } from "../components/AdminEditIconButton";
import styles from "./admin.notes.module.css";

const STATUS_TABS = ["all", "published", "draft", "archived"] as const;
type StatusTab = (typeof STATUS_TABS)[number];

/* Dashboard-only subsets: no control of their own, so a notice names them. */
const LIST_FILTERS = ["no-file"] as const;
type ListFilter = (typeof LIST_FILTERS)[number];

const FIRST_SORT_ORDER: Record<NotesSortColumn, SortOrder> = {
  title: "asc",
  status: "asc",
  category: "asc",
  price: "desc",
  sales: "desc",
  createdAt: "desc",
};

/* Shared by the loading and loaded tables so the columns do not jump. */
const TableColumns = () => (
  <colgroup>
    <col />
    <col className={styles.colStatus} />
    <col className={styles.colCategory} />
    <col className={styles.colMoney} />
    <col className={styles.colCount} />
    <col className={styles.colDate} />
    <col className={styles.colActions} />
  </colgroup>
);

const ProductRowSkeleton = () => (
  <tr>
    <td>
      <div className={styles.stack}>
        <Skeleton style={{ height: "0.875rem", width: "60%" }} />
        <Skeleton style={{ height: "0.75rem", width: "35%" }} />
      </div>
    </td>
    <td>
      <Skeleton style={{ height: "1.125rem", width: "4.25rem" }} />
    </td>
    <td>
      <Skeleton style={{ height: "0.875rem", width: "5.5rem" }} />
    </td>
    <td>
      <Skeleton style={{ height: "0.875rem", width: "3.5rem", marginLeft: "auto" }} />
    </td>
    <td>
      <Skeleton style={{ height: "0.875rem", width: "1.5rem", marginLeft: "auto" }} />
    </td>
    <td>
      <Skeleton style={{ height: "0.875rem", width: "5rem" }} />
    </td>
    <td>
      <Skeleton style={{ height: "1.5rem", width: "4rem", marginLeft: "auto" }} />
    </td>
  </tr>
);

const ProductCardSkeleton = () => (
  <div className={styles.card}>
    <div className={styles.cardHeader}>
      <div className={styles.stack}>
        <Skeleton style={{ height: "1rem", width: "12rem", maxWidth: "100%" }} />
        <Skeleton style={{ height: "0.75rem", width: "8rem", maxWidth: "100%" }} />
      </div>
      <Skeleton style={{ height: "2rem", width: "4.25rem", flexShrink: 0 }} />
    </div>
    <div className={styles.cardStats}>
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} style={{ height: "2rem", width: "100%" }} />
      ))}
    </div>
  </div>
);

export default function AdminNotesPage() {
  const deactivateMutation = useDeactivateProductMutation();

  const [isDeactivateDialogOpen, setIsDeactivateDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<{ id: number; title: string } | null>(null);
  const [panelProduct, setPanelProduct] = useState<AdminNotesPageItem | null>(null);

  const { read, readId, write } = useListUrlParams();
  const statusFilter = read<StatusTab>("status", STATUS_TABS, "all");
  const listFilter = read<ListFilter | "">("filter", LIST_FILTERS, "");
  const focusId = readId();

  const [searchQuery, setSearchQuery] = useState("");
  const sort = useServerTableSort(FIRST_SORT_ORDER);
  const [page, setPage] = useListPage(
    JSON.stringify([searchQuery, statusFilter, listFilter, focusId, sort.sortBy, sort.sortOrder])
  );

  const { data, isFetching, isPlaceholderData, isError, error, refetch } = useAdminNotesPageQuery({
    page,
    search: searchQuery || undefined,
    status: statusFilter === "all" ? undefined : statusFilter,
    filter: listFilter || undefined,
    id: focusId ?? undefined,
    sortBy: sort.sortBy ?? undefined,
    sortOrder: sort.sortBy ? sort.sortOrder : undefined,
  });
  const products = isPlaceholderData ? undefined : data?.items;

  const focusedProduct = useMemo(
    () => (focusId === null ? null : products?.find((p) => p.id === focusId) ?? null),
    [products, focusId]
  );

  /* A link to one note opens its panel once; a refetch after the admin closes it must not reopen it. */
  const openedFocusId = useRef<number | null>(null);
  useEffect(() => {
    if (!focusedProduct || openedFocusId.current === focusedProduct.id) return;
    openedFocusId.current = focusedProduct.id;
    setPanelProduct(focusedProduct);
  }, [focusedProduct]);

  useRefetchOnLinkArrival(listFilter !== "" || focusId !== null, isFetching, refetch);

  const counts = data?.statusCounts;
  const statusTabs = [
    { value: "all", label: "All", count: counts?.all },
    { value: "published", label: "Published", count: counts?.published },
    { value: "draft", label: "Draft", count: counts?.draft },
    { value: "archived", label: "Archived", count: counts?.archived },
  ];

  const sortedProducts = products ?? [];
  const matchingCount = products ? data?.total : undefined;

  const hasActiveFilters =
    searchQuery !== "" ||
    statusFilter !== "all" ||
    listFilter !== "" ||
    focusId !== null;

  const clearFilters = () => {
    setSearchQuery("");
    write({ status: null, filter: null, id: null });
  };

  const formatNumber = (num: number): string => num.toLocaleString('en-IN');
  const formatCurrency = (amount: number): string => `₹${amount.toLocaleString('en-IN')}`;
  const formatDate = (date: Date | string | null): string => {
    if (!date) return 'Not recorded';
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    }).format(new Date(date));
  };

  const getProductUrl = (slug: string): string => `/study-notes/${slug}`;

  const handleDeactivateClick = (productId: number, productTitle: string) => {
    setSelectedProduct({ id: productId, title: productTitle });
    setIsDeactivateDialogOpen(true);
  };

  const handleDeactivateConfirm = async () => {
    if (!selectedProduct) return;

    try {
      await deactivateMutation.mutateAsync({ productId: selectedProduct.id });
      toast.success(`"${selectedProduct.title}" is now archived.`);
      setIsDeactivateDialogOpen(false);
      setSelectedProduct(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Could not archive these notes.";
      toast.error(errorMessage);
    }
  };

  /* The list uses the compact form without the icon; the detail panel keeps the full badge. */
  const getStatusBadge = (status: DigitalProductStatus | null, compact = false) => {
    const className = compact ? styles.flag : undefined;
    switch (status) {
      case 'published':
        return (
          <Badge variant="success" className={className}>
            {!compact && <CheckCircle2 size={14} />}
            Published
          </Badge>
        );
      case 'draft':
        return (
          <Badge variant="outline" className={className}>
            {!compact && <ArchiveRestore size={14} />}
            Draft
          </Badge>
        );
      case 'archived':
        return (
          <Badge variant="destructive" className={className}>
            {!compact && <Archive size={14} />}
            Archived
          </Badge>
        );
      default:
        return <Badge variant="outline" className={className}>{status ?? "Unknown"}</Badge>;
    }
  };

  const renderTitle = (product: AdminNotesPageItem) => (
    <a
      href={product.status === 'published' ? getProductUrl(product.slug) : adminPreviewPath("digital_product", product.id)}
      target="_blank"
      rel="noopener noreferrer"
      className={`${styles.titleLink} ${styles.truncate}`}
      title={product.title}
    >
      {product.title}
    </a>
  );

  const renderActions = (product: AdminNotesPageItem) => (
    <div className={styles.rowActions}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-md"
            className={styles.iconButton}
            aria-label={`View details for ${product.title}`}
            onClick={() => setPanelProduct(product)}
          >
            <Eye />
          </Button>
        </TooltipTrigger>
        <TooltipContent>View details</TooltipContent>
      </Tooltip>
      <AdminEditIconButton type="digital_product" id={product.id} title={product.title} className={styles.iconButton} />
      {product.status === 'published' && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-md"
              className={`${styles.iconButton} ${styles.iconButtonDanger}`}
              aria-label={`Archive ${product.title}`}
              onClick={() => handleDeactivateClick(product.id, product.title)}
              disabled={deactivateMutation.isPending && deactivateMutation.variables?.productId === product.id}
            >
              <Archive />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Archive</TooltipContent>
        </Tooltip>
      )}
    </div>
  );

  const renderContent = () => {
    if (isError) {
      return (
        <ConsoleListEmpty
          tone="error"
          icon={<AlertTriangle size={24} />}
          title="Could not load the study notes"
          description={error instanceof Error ? error.message : "The request did not come back. Check your connection and try again."}
        >
          <Button variant="outline" onClick={() => refetch()}>Try again</Button>
        </ConsoleListEmpty>
      );
    }

    if (!products) {
      return (
        <>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <TableColumns />
              <tbody>
                {Array.from({ length: 8 }).map((_, i) => <ProductRowSkeleton key={i} />)}
              </tbody>
            </table>
          </div>
          <div className={styles.cardsContainer}>
            {Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={i} />)}
          </div>
        </>
      );
    }

    if (sortedProducts.length === 0) {
      const description =
        focusId !== null && !focusedProduct
          ? "The linked study note is no longer in the list. It may have been deleted."
          : listFilter === "no-file"
            ? "Every study note that matches these filters has a file to download."
            : hasActiveFilters
              ? "Nothing here for this status and search. Widen the filters to see the rest."
              : "Study notes teachers publish will be listed here.";
      return (
        <ConsoleListEmpty
          icon={<FileText size={24} />}
          title={hasActiveFilters ? "No study notes match these filters" : "No study notes yet"}
          description={description}
        >
          {hasActiveFilters && (
            <Button variant="outline" onClick={clearFilters}>Show all study notes</Button>
          )}
        </ConsoleListEmpty>
      );
    }

    return (
      <>
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <TableColumns />
            <thead>
              <tr>
                <SortableTh column="title" sort={sort}>Notes</SortableTh>
                <SortableTh column="status" sort={sort}>Status</SortableTh>
                <SortableTh column="category" sort={sort}>Category</SortableTh>
                <SortableTh column="price" sort={sort} className={styles.num}>Price</SortableTh>
                <SortableTh column="sales" sort={sort} className={styles.num}>Sales</SortableTh>
                <SortableTh column="createdAt" sort={sort}>Created</SortableTh>
                <th><span className={styles.srOnly}>Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {sortedProducts.map((product) => {
                const sales = product.totalPurchases ?? 0;
                return (
                  <tr key={product.id}>
                    <td>
                      <div className={styles.stack}>
                        <span className={styles.primaryLine}>{renderTitle(product)}</span>
                        <span className={styles.secondaryLine} title={product.teacherName}>{product.teacherName}</span>
                      </div>
                    </td>
                    <td>{getStatusBadge(product.status, true)}</td>
                    <td
                      className={product.category ? undefined : styles.zero}
                      title={product.category || undefined}
                    >
                      {product.category || "-"}
                    </td>
                    <td className={styles.num} title={formatCurrency(product.price)}>
                      {formatCurrency(product.price)}
                    </td>
                    <td className={`${styles.num} ${sales === 0 ? styles.zero : ""}`}>
                      {formatNumber(sales)}
                    </td>
                    <td className={styles.date}>{formatDate(product.createdAt)}</td>
                    <td>{renderActions(product)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className={styles.cardsContainer}>
          {sortedProducts.map((product) => {
            const sales = product.totalPurchases ?? 0;
            return (
              <article key={product.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={styles.stack}>
                    <span className={styles.primaryLine}>
                      {renderTitle(product)}
                      {getStatusBadge(product.status, true)}
                    </span>
                    <span className={styles.secondaryLine} title={product.teacherName}>{product.teacherName}</span>
                  </div>
                  {renderActions(product)}
                </div>
                <dl className={styles.cardStats}>
                  <div className={styles.cardStat}>
                    <dt>Category</dt>
                    <dd className={product.category ? undefined : styles.zero}>{product.category || "-"}</dd>
                  </div>
                  <div className={styles.cardStat}>
                    <dt>Price</dt>
                    <dd>{formatCurrency(product.price)}</dd>
                  </div>
                  <div className={styles.cardStat}>
                    <dt>Sales</dt>
                    <dd className={sales === 0 ? styles.zero : undefined}>{formatNumber(sales)}</dd>
                  </div>
                  <div className={styles.cardStat}>
                    <dt>Created</dt>
                    <dd>{formatDate(product.createdAt)}</dd>
                  </div>
                </dl>
              </article>
            );
          })}
        </div>
      </>
    );
  };

  return (
    <>
      <Helmet>
        <title>Study notes - Testkart Admin</title>
        <meta name="description" content="Study notes and digital products across the Testkart platform." />
      </Helmet>
      <div className={styles.page}>
        <ConsolePageHeader title="Study notes" />

        <ConsoleListToolbar
          tabs={statusTabs}
          value={statusFilter}
          onValueChange={(value) => write({ status: value === "all" ? null : value })}
          tabsLabel="Study note status"
          search={{
            value: searchQuery,
            onChange: setSearchQuery,
            placeholder: "Search by title or teacher",
            label: "Search study notes",
          }}
        />

        {listFilter === "no-file" && (
          <ConsoleFilterNotice
            label="Notes with no file to download"
            count={matchingCount}
            onClear={() => write({ filter: null })}
            clearLabel="Show all"
          />
        )}
        {focusId !== null && (
          <ConsoleFilterNotice
            label={focusedProduct?.title ?? `Study note #${focusId}`}
            count={matchingCount}
            onClear={() => write({ id: null })}
            clearLabel="Show all"
          />
        )}

        <div className={styles.results}>{renderContent()}</div>

        {products && data && data.totalPages > 1 && (
          <ConsoleListPagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />
        )}

        <ConsoleConfirmDialog
          open={isDeactivateDialogOpen}
          onOpenChange={setIsDeactivateDialogOpen}
          title="Archive these notes?"
          description={`"${selectedProduct?.title ?? ""}" comes off the site and students can no longer buy it. Anyone who already bought it keeps access.`}
          tone="destructive"
          icon={<Archive size={20} />}
          confirmLabel="Archive notes"
          pendingLabel="Archiving..."
          isPending={deactivateMutation.isPending}
          onConfirm={handleDeactivateConfirm}
        />

        {panelProduct && (
          <AdminProductDetailPanel
            open={!!panelProduct}
            onOpenChange={(open) => { if (!open) setPanelProduct(null); }}
            title={panelProduct.title}
            productTypeLabel="Study notes"
            statusBadge={getStatusBadge(panelProduct.status)}
            isLive={panelProduct.status === 'published'}
            publicUrl={panelProduct.status === 'published' ? getProductUrl(panelProduct.slug) : null}
            previewUrl={adminPreviewPath("digital_product", panelProduct.id)}
            editUrl={adminEditPath("digital_product", panelProduct.id)}
            teacherName={panelProduct.teacherName}
            price={panelProduct.price}
            createdAt={panelProduct.createdAt}
            stats={[
              { label: "PDF files", value: formatNumber(panelProduct.filesCount), icon: <Files size={18} /> },
              { label: "Total pages", value: formatNumber(panelProduct.totalPages), icon: <FileText size={18} /> },
              { label: "Sales", value: formatNumber(panelProduct.totalPurchases ?? 0), icon: <ShoppingCart size={18} /> },
            ]}
            onUnpublish={
              panelProduct.status === 'published'
                ? () => {
                    handleDeactivateClick(panelProduct.id, panelProduct.title);
                    setPanelProduct(null);
                  }
                : undefined
            }
            unpublishLabel="Archive"
            unpublishPendingLabel="Archiving..."
            isUnpublishing={deactivateMutation.isPending && deactivateMutation.variables?.productId === panelProduct.id}
          />
        )}
      </div>
    </>
  );
}
