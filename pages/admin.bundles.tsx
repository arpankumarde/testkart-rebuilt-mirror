import React, { useState, useMemo, useEffect, useRef } from "react";
import { Helmet } from "react-helmet";
import { useAdminBundlesQuery, useDeactivateBundleMutation } from "../helpers/useAdminBundles";
import { useListUrlParams } from "../helpers/useListUrlParams";
import { useRefetchOnLinkArrival } from "../helpers/useRefetchOnLinkArrival";
import { useTableSort, SortAccessors } from "../helpers/useTableSort";
import { SortableTh } from "../components/SortableTh";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { Badge } from "../components/Badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/Select";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/Tooltip";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { ConsoleListToolbar, consoleToolbarControlClass } from "../components/ConsoleListToolbar";
import { ConsoleListEmpty } from "../components/ConsoleListEmpty";
import { ConsoleFilterNotice } from "../components/ConsoleFilterNotice";
import { ConsoleConfirmDialog } from "../components/ConsoleConfirmDialog";
import {
  CheckCircle2,
  Ban,
  Package,
  AlertTriangle,
  ArchiveRestore,
  Boxes,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { AdminBundleListItem } from "../endpoints/admin/bundles/list_GET.schema";
import { AdminProductDetailPanel } from "../components/AdminProductDetailPanel";
import { adminPreviewPath } from "../helpers/useAdminContentPreview";
import styles from "./admin.bundles.module.css";

const ALL_TEACHERS = "__all__";

const STATUS_TABS = ["all", "published", "unpublished"] as const;
type StatusTab = (typeof STATUS_TABS)[number];

const SORT_ACCESSORS: SortAccessors<AdminBundleListItem, "title" | "price" | "discount" | "createdAt"> = {
  title: (b) => b.title,
  price: (b) => b.price,
  discount: (b) => b.discountPercentage ?? null,
  createdAt: (b) => (b.createdAt ? new Date(b.createdAt) : null),
};

/* Shared by the loading and loaded tables so the columns do not jump. */
const TableColumns = () => (
  <colgroup>
    <col />
    <col className={styles.colMoney} />
    <col className={styles.colDiscount} />
    <col className={styles.colDate} />
    <col className={styles.colActions} />
  </colgroup>
);

const BundleRowSkeleton = () => (
  <tr>
    <td>
      <div className={styles.stack}>
        <Skeleton style={{ height: "0.875rem", width: "60%" }} />
        <Skeleton style={{ height: "0.75rem", width: "30%" }} />
      </div>
    </td>
    <td>
      <Skeleton style={{ height: "0.875rem", width: "3.5rem", marginLeft: "auto" }} />
    </td>
    <td>
      <Skeleton style={{ height: "0.875rem", width: "2rem", marginLeft: "auto" }} />
    </td>
    <td>
      <Skeleton style={{ height: "0.875rem", width: "5rem" }} />
    </td>
    <td>
      <Skeleton style={{ height: "1.5rem", width: "4rem", marginLeft: "auto" }} />
    </td>
  </tr>
);

const BundleCardSkeleton = () => (
  <div className={styles.card}>
    <div className={styles.cardHeader}>
      <div className={styles.stack}>
        <Skeleton style={{ height: "1rem", width: "12rem", maxWidth: "100%" }} />
        <Skeleton style={{ height: "0.75rem", width: "8rem", maxWidth: "100%" }} />
      </div>
      <Skeleton style={{ height: "2rem", width: "4.25rem", flexShrink: 0 }} />
    </div>
    <div className={styles.cardStats}>
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} style={{ height: "2rem", width: "100%" }} />
      ))}
    </div>
  </div>
);

export default function AdminBundlesPage() {
  const { data: bundles, isFetching, isError, error, refetch } = useAdminBundlesQuery();
  const deactivateMutation = useDeactivateBundleMutation();

  const [isDeactivateDialogOpen, setIsDeactivateDialogOpen] = useState(false);
  const [selectedBundle, setSelectedBundle] = useState<{ id: number; title: string } | null>(null);
  const [panelBundle, setPanelBundle] = useState<AdminBundleListItem | null>(null);

  const { read, readId, write } = useListUrlParams();
  const statusFilter = read<StatusTab>("status", STATUS_TABS, "all");
  const focusId = readId();

  const [searchQuery, setSearchQuery] = useState("");
  const [teacherFilter, setTeacherFilter] = useState(ALL_TEACHERS);

  const focusedBundle = useMemo(
    () => (focusId === null ? null : bundles?.find((b) => b.id === focusId) ?? null),
    [bundles, focusId]
  );

  /* A link to one bundle opens its panel once; a refetch after the admin closes it must not reopen it. */
  const openedFocusId = useRef<number | null>(null);
  useEffect(() => {
    if (!focusedBundle || openedFocusId.current === focusedBundle.id) return;
    openedFocusId.current = focusedBundle.id;
    setPanelBundle(focusedBundle);
  }, [focusedBundle]);

  useRefetchOnLinkArrival(statusFilter !== "all" || focusId !== null, isFetching, refetch);

  const teachers = useMemo(() => {
    if (!bundles) return [];
    return Array.from(new Set(bundles.map((b) => b.teacherName))).sort();
  }, [bundles]);

  const statusTabs = useMemo(() => {
    const all = bundles ?? [];
    return [
      { value: "all", label: "All", count: all.length },
      { value: "published", label: "Published", count: all.filter((b) => b.isPublished).length },
      { value: "unpublished", label: "Unpublished", count: all.filter((b) => !b.isPublished).length },
    ];
  }, [bundles]);

  const filteredBundles = useMemo(() => {
    if (!bundles) return [];
    return bundles.filter((bundle) => {
      const matchesSearch = bundle.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "published" && bundle.isPublished) ||
        (statusFilter === "unpublished" && !bundle.isPublished);
      const matchesTeacher = teacherFilter === ALL_TEACHERS || bundle.teacherName === teacherFilter;
      const matchesFocus = focusId === null || bundle.id === focusId;
      return matchesSearch && matchesStatus && matchesTeacher && matchesFocus;
    });
  }, [bundles, searchQuery, statusFilter, teacherFilter, focusId]);

  const { sorted: sortedBundles, ...sort } = useTableSort(filteredBundles, SORT_ACCESSORS);

  const hasActiveFilters =
    searchQuery !== "" || statusFilter !== "all" || teacherFilter !== ALL_TEACHERS || focusId !== null;

  const clearFilters = () => {
    setSearchQuery("");
    setTeacherFilter(ALL_TEACHERS);
    write({ status: null, id: null });
  };

  const formatCurrency = (amount: number): string => `₹${amount.toLocaleString('en-IN')}`;
  const formatDate = (date: Date | string | null): string => {
    if (!date) return 'Not recorded';
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    }).format(new Date(date));
  };

  const getBundleUrl = (slug: string): string => `/bundles/${slug}`;

  const handleDeactivateClick = (bundleId: number, bundleTitle: string) => {
    setSelectedBundle({ id: bundleId, title: bundleTitle });
    setIsDeactivateDialogOpen(true);
  };

  const handleDeactivateConfirm = async () => {
    if (!selectedBundle) return;

    try {
      await deactivateMutation.mutateAsync({ bundleId: selectedBundle.id });
      toast.success(`"${selectedBundle.title}" is now unpublished.`);
      setIsDeactivateDialogOpen(false);
      setSelectedBundle(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Could not unpublish the bundle.";
      toast.error(errorMessage);
    }
  };

  /* Published is the usual state, so only an unpublished bundle carries a flag. */
  const renderIdentity = (bundle: AdminBundleListItem) => (
    <span className={styles.primaryLine}>
      <a
        href={bundle.isPublished ? getBundleUrl(bundle.slug) : adminPreviewPath("course_bundle", bundle.id)}
        target="_blank"
        rel="noopener noreferrer"
        className={`${styles.titleLink} ${styles.truncate}`}
        title={bundle.title}
      >
        {bundle.title}
      </a>
      {!bundle.isPublished && (
        <Badge variant="outline" className={styles.flag}>Unpublished</Badge>
      )}
    </span>
  );

  const renderActions = (bundle: AdminBundleListItem) => (
    <div className={styles.rowActions}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-md"
            className={styles.iconButton}
            aria-label={`View details for ${bundle.title}`}
            onClick={() => setPanelBundle(bundle)}
          >
            <Eye />
          </Button>
        </TooltipTrigger>
        <TooltipContent>View details</TooltipContent>
      </Tooltip>
      {bundle.isPublished && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-md"
              className={`${styles.iconButton} ${styles.iconButtonDanger}`}
              aria-label={`Unpublish ${bundle.title}`}
              onClick={() => handleDeactivateClick(bundle.id, bundle.title)}
              disabled={deactivateMutation.isPending && deactivateMutation.variables?.bundleId === bundle.id}
            >
              <Ban />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Unpublish</TooltipContent>
        </Tooltip>
      )}
    </div>
  );

  const renderContent = () => {
    if (isFetching) {
      return (
        <>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <TableColumns />
              <tbody>
                {Array.from({ length: 8 }).map((_, i) => <BundleRowSkeleton key={i} />)}
              </tbody>
            </table>
          </div>
          <div className={styles.cardsContainer}>
            {Array.from({ length: 4 }).map((_, i) => <BundleCardSkeleton key={i} />)}
          </div>
        </>
      );
    }

    if (isError) {
      return (
        <ConsoleListEmpty
          tone="error"
          icon={<AlertTriangle size={24} />}
          title="Could not load the bundles"
          description={error instanceof Error ? error.message : "The request did not come back. Check your connection and try again."}
        >
          <Button variant="outline" onClick={() => refetch()}>Try again</Button>
        </ConsoleListEmpty>
      );
    }

    if (filteredBundles.length === 0) {
      const description =
        focusId !== null && !focusedBundle
          ? "The linked bundle is no longer in the list. It may have been deleted."
          : hasActiveFilters
            ? "Nothing here for this status, teacher and search. Widen the filters to see the rest."
            : "Bundles teachers publish will be listed here.";
      return (
        <ConsoleListEmpty
          icon={<Package size={24} />}
          title={hasActiveFilters ? "No bundles match these filters" : "No bundles yet"}
          description={description}
        >
          {hasActiveFilters && (
            <Button variant="outline" onClick={clearFilters}>Show all bundles</Button>
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
                <SortableTh column="title" sort={sort}>Bundle</SortableTh>
                <SortableTh column="price" sort={sort} className={styles.num}>Price</SortableTh>
                <SortableTh column="discount" sort={sort} className={styles.num}>Discount</SortableTh>
                <SortableTh column="createdAt" sort={sort}>Created</SortableTh>
                <th><span className={styles.srOnly}>Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {sortedBundles.map((bundle) => (
                <tr key={bundle.id}>
                  <td>
                    <div className={styles.stack}>
                      {renderIdentity(bundle)}
                      <span className={styles.secondaryLine} title={bundle.teacherName}>{bundle.teacherName}</span>
                    </div>
                  </td>
                  <td className={styles.num} title={formatCurrency(bundle.price)}>
                    {formatCurrency(bundle.price)}
                  </td>
                  <td className={`${styles.num} ${bundle.discountPercentage ? "" : styles.zero}`}>
                    {bundle.discountPercentage ? `${bundle.discountPercentage}%` : "-"}
                  </td>
                  <td className={styles.date}>{formatDate(bundle.createdAt)}</td>
                  <td>{renderActions(bundle)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={styles.cardsContainer}>
          {sortedBundles.map((bundle) => (
            <article key={bundle.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.stack}>
                  {renderIdentity(bundle)}
                  <span className={styles.secondaryLine} title={bundle.teacherName}>{bundle.teacherName}</span>
                </div>
                {renderActions(bundle)}
              </div>
              <dl className={styles.cardStats}>
                <div className={styles.cardStat}>
                  <dt>Price</dt>
                  <dd>{formatCurrency(bundle.price)}</dd>
                </div>
                <div className={styles.cardStat}>
                  <dt>Discount</dt>
                  <dd className={bundle.discountPercentage ? undefined : styles.zero}>
                    {bundle.discountPercentage ? `${bundle.discountPercentage}%` : "-"}
                  </dd>
                </div>
                <div className={styles.cardStat}>
                  <dt>Created</dt>
                  <dd>{formatDate(bundle.createdAt)}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </>
    );
  };

  return (
    <>
      <Helmet>
        <title>Bundles - Testkart Admin</title>
        <meta name="description" content="Course bundles across the Testkart platform." />
      </Helmet>
      <div className={styles.page}>
        <ConsolePageHeader title="Bundles" />

        <ConsoleListToolbar
          tabs={statusTabs}
          value={statusFilter}
          onValueChange={(value) => write({ status: value === "all" ? null : value })}
          tabsLabel="Bundle status"
          search={{
            value: searchQuery,
            onChange: setSearchQuery,
            placeholder: "Search by title",
            label: "Search bundles",
          }}
        >
          <Select value={teacherFilter} onValueChange={setTeacherFilter}>
            <SelectTrigger className={consoleToolbarControlClass}>
              <SelectValue placeholder="All teachers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_TEACHERS}>All teachers</SelectItem>
              {teachers.map((teacher) => (
                <SelectItem key={teacher} value={teacher}>{teacher}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ConsoleListToolbar>

        {focusId !== null && (
          <ConsoleFilterNotice
            label={focusedBundle?.title ?? `Bundle #${focusId}`}
            count={bundles ? filteredBundles.length : undefined}
            onClear={() => write({ id: null })}
            clearLabel="Show all"
          />
        )}

        <div className={styles.results}>{renderContent()}</div>

        <ConsoleConfirmDialog
          open={isDeactivateDialogOpen}
          onOpenChange={setIsDeactivateDialogOpen}
          title="Unpublish this bundle?"
          description={`"${selectedBundle?.title ?? ""}" comes off the site and students can no longer buy it. Anyone who already owns it keeps access.`}
          tone="destructive"
          icon={<Ban size={20} />}
          confirmLabel="Unpublish bundle"
          pendingLabel="Unpublishing..."
          isPending={deactivateMutation.isPending}
          onConfirm={handleDeactivateConfirm}
        />

        {panelBundle && (
          <AdminProductDetailPanel
            open={!!panelBundle}
            onOpenChange={(open) => { if (!open) setPanelBundle(null); }}
            title={panelBundle.title}
            productTypeLabel="Bundle"
            statusBadge={
              panelBundle.isPublished ? (
                <Badge variant="success">
                  <CheckCircle2 size={14} />
                  Published
                </Badge>
              ) : (
                <Badge variant="outline">
                  <ArchiveRestore size={14} />
                  Unpublished
                </Badge>
              )
            }
            isLive={panelBundle.isPublished}
            publicUrl={panelBundle.isPublished ? getBundleUrl(panelBundle.slug) : null}
            previewUrl={adminPreviewPath("course_bundle", panelBundle.id)}
            teacherName={panelBundle.teacherName}
            price={panelBundle.price}
            createdAt={panelBundle.createdAt}
            stats={[
              { label: "Items added", value: panelBundle.itemsCount, icon: <Boxes size={18} /> },
            ]}
            onUnpublish={
              panelBundle.isPublished
                ? () => {
                    handleDeactivateClick(panelBundle.id, panelBundle.title);
                    setPanelBundle(null);
                  }
                : undefined
            }
            isUnpublishing={deactivateMutation.isPending && deactivateMutation.variables?.bundleId === panelBundle.id}
          />
        )}
      </div>
    </>
  );
}
