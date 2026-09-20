import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useDebouncedCallback } from "use-debounce";
import {
  useAdminExamDashboardQuery,
  useBulkUpdateExamsMutation,
} from "../helpers/useAdminExamDashboard";
import {
  ADMIN_EXAM_SECTION_TYPES,
  ADMIN_EXAM_SECTION_META,
  type AdminExamSectionType,
} from "../helpers/examContentTypes";
import { humanisePageType } from "../helpers/adminContentSurfaces";
import { useListUrlParams } from "../helpers/useListUrlParams";
import { useRefetchOnLinkArrival } from "../helpers/useRefetchOnLinkArrival";
import { useTableSort, type SortAccessors } from "../helpers/useTableSort";
import {
  type ExamDashboardRow,
  type DataHealthFlag,
} from "../endpoints/admin/exam-dashboard/list_GET.schema";
import { Button } from "./Button";
import { ConsoleFilterNotice } from "./ConsoleFilterNotice";
import { Input } from "./Input";
import { Checkbox } from "./Checkbox";
import { Badge } from "./Badge";
import { Skeleton } from "./Skeleton";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectSeparator,
} from "./Select";
import { DatePicker } from "./DatePicker";
import { AdminOwnerSelect } from "./AdminOwnerSelect";
import { SortableTh } from "./SortableTh";
import {
  Search,
  FileText,
  ExternalLink,
  Edit,
  Trash2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import styles from "./AdminExamDashboardTable.module.css";

const PAGE_SIZE = 50;
const STALE_DAYS = 90;
const DUE_SOON_DAYS = 7;
const SEARCH_PARAM = "search";
const SEARCH_URL_DELAY_MS = 300;
const CONTENT_PARAM = "content";
const FILTER_PARAM = "filter";
const READY_FOR_REVIEW_FILTER = "ready-for-review";
const CONTENT_FILTERS = ["all", "complete", "in-progress", "not-started", READY_FOR_REVIEW_FILTER] as const;

type ContentBucket = "complete" | "in-progress" | "not-started";
type DueBucket = "overdue" | "due-soon" | "upcoming" | "none";

function getContentBucket(row: ExamDashboardRow): ContentBucket {
  if (row.publishedSectionCount >= row.totalSectionCount) return "complete";
  const hasAny = ADMIN_EXAM_SECTION_TYPES.some(
    (t) => row.contentStatusByType[t] !== "none"
  );
  return hasAny ? "in-progress" : "not-started";
}

function getDueBucket(row: ExamDashboardRow): DueBucket {
  if (!row.contentDueDate) return "none";
  const due = new Date(row.contentDueDate);
  const now = new Date();
  const diffDays = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return "overdue";
  if (diffDays <= DUE_SOON_DAYS) return "due-soon";
  return "upcoming";
}

function isStale(row: ExamDashboardRow): boolean {
  if (!row.lastContentUpdatedAt) return true;
  const diffDays =
    (Date.now() - new Date(row.lastContentUpdatedAt).getTime()) / (1000 * 60 * 60 * 24);
  return diffDays >= STALE_DAYS;
}

const DATA_HEALTH_LABELS: Record<DataHealthFlag, string> = {
  "duplicate-name": "Duplicate name",
  "duplicate-slug": "Duplicate slug",
  "missing-full-name": "Missing full name",
  "missing-description": "Missing description",
};

type IssueFilter = "unpublished-edits" | "missing-seo" | "missing-faq";

// Subsets the Content dashboard's exam page queues link to. They have no control
// of their own, so the filter param is the only way in and the notice the way out.
const ISSUE_FILTERS: Record<
  IssueFilter,
  { label: string; rowLabel: string; typesOf: (row: ExamDashboardRow) => AdminExamSectionType[] }
> = {
  "unpublished-edits": {
    label: "Live pages edited but not republished",
    rowLabel: "Not republished",
    typesOf: (row) => row.unpublishedEditTypes,
  },
  "missing-seo": {
    label: "Live pages missing an SEO title or description",
    rowLabel: "Missing SEO",
    typesOf: (row) => row.missingSeoTypes,
  },
  "missing-faq": {
    label: "Live pages with no FAQ block",
    rowLabel: "No FAQ",
    typesOf: (row) => row.missingFaqTypes,
  },
};
const ISSUE_FILTER_VALUES = Object.keys(ISSUE_FILTERS) as IssueFilter[];

const countOf = (n: number, noun: string) => `${n.toLocaleString("en-IN")} ${noun}${n === 1 ? "" : "s"}`;

type ExamSortKey = "exam" | "category" | "content" | "products" | "owner" | "updated" | "due";

const SORT_ACCESSORS: SortAccessors<ExamDashboardRow, ExamSortKey> = {
  exam: (row) => row.examName,
  category: (row) => row.categoryName,
  content: (row) => row.publishedSectionCount,
  products: (row) => row.totalProductCount,
  owner: (row) => row.ownerTag,
  updated: (row) => (row.lastContentUpdatedAt ? new Date(row.lastContentUpdatedAt) : null),
  due: (row) => (row.contentDueDate ? new Date(row.contentDueDate) : null),
};

interface AdminExamDashboardTableProps {
  onEditExam: (exam: ExamDashboardRow) => void;
  onDeleteExam: (exam: ExamDashboardRow) => void;
  onAddExam: () => void;
  className?: string;
}

export const AdminExamDashboardTable: React.FC<AdminExamDashboardTableProps> = ({
  onEditExam,
  onDeleteExam,
  onAddExam,
  className,
}) => {
  const { data, isFetching, error, refetch } = useAdminExamDashboardQuery();
  const bulkUpdateMutation = useBulkUpdateExamsMutation();

  const [searchParams, setSearchParams] = useSearchParams();
  const urlSearch = searchParams.get(SEARCH_PARAM) ?? "";
  const [search, setSearch] = useState(urlSearch);
  // The search value last written to or read from the URL, so a URL change
  // made by this table is not mistaken for back/forward or an inbound link.
  const syncedSearch = useRef(urlSearch);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const { read, write } = useListUrlParams();
  const contentFilter = read(CONTENT_PARAM, CONTENT_FILTERS, "all");
  const issueFilter = read<IssueFilter | "">(FILTER_PARAM, ISSUE_FILTER_VALUES, "");
  useRefetchOnLinkArrival(issueFilter !== "" || contentFilter !== "all", isFetching, refetch);
  const issue = issueFilter ? ISSUE_FILTERS[issueFilter] : null;
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [dueFilter, setDueFilter] = useState<string>("all");
  const [staleOnly, setStaleOnly] = useState(false);
  const [healthOnly, setHealthOnly] = useState(false);
  const [noProductsOnly, setNoProductsOnly] = useState(false);
  const [showHealthPanel, setShowHealthPanel] = useState(false);
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkAction, setBulkAction] = useState<
    "" | "category" | "owner" | "due-date"
  >("");
  const [bulkCategoryId, setBulkCategoryId] = useState<string>("");
  const [bulkOwnerTag, setBulkOwnerTag] = useState<string | null | undefined>(undefined);
  const [bulkDueDate, setBulkDueDate] = useState<Date | undefined>(undefined);

  const writeSearchToUrl = useDebouncedCallback((value: string) => {
    syncedSearch.current = value;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(SEARCH_PARAM, value);
        else next.delete(SEARCH_PARAM);
        return next;
      },
      { replace: true }
    );
  }, SEARCH_URL_DELAY_MS);

  useEffect(() => () => writeSearchToUrl.cancel(), [writeSearchToUrl]);

  useEffect(() => {
    if (urlSearch === syncedSearch.current) return;
    writeSearchToUrl.cancel();
    syncedSearch.current = urlSearch;
    setSearch(urlSearch);
    setPage(0);
  }, [urlSearch, writeSearchToUrl]);

  useEffect(() => {
    setPage(0);
  }, [contentFilter, issueFilter]);

  const owners = useMemo(() => {
    if (!data) return [];
    const set = new Set<string>();
    for (const row of data.rows) {
      if (row.ownerTag) set.add(row.ownerTag);
    }
    return Array.from(set).sort();
  }, [data]);

  const filteredRows = useMemo(() => {
    if (!data) return [];
    const lowerSearch = search.trim().toLowerCase();

    return data.rows.filter((row) => {
      if (
        lowerSearch &&
        !row.examName.toLowerCase().includes(lowerSearch) &&
        !row.fullName.toLowerCase().includes(lowerSearch) &&
        !row.categoryName.toLowerCase().includes(lowerSearch)
      ) {
        return false;
      }
      if (categoryFilter !== "all" && String(row.categoryId) !== categoryFilter) {
        return false;
      }
      if (contentFilter === READY_FOR_REVIEW_FILTER) {
        if (row.readyForReviewTypes.length === 0) return false;
      } else if (contentFilter !== "all" && getContentBucket(row) !== contentFilter) {
        return false;
      }
      if (issue && issue.typesOf(row).length === 0) return false;
      if (ownerFilter !== "all") {
        if (ownerFilter === "unassigned" && row.ownerTag) return false;
        if (ownerFilter !== "unassigned" && row.ownerTag !== ownerFilter) return false;
      }
      if (dueFilter !== "all" && getDueBucket(row) !== dueFilter) {
        return false;
      }
      if (staleOnly && !isStale(row)) return false;
      if (healthOnly && row.dataHealthFlags.length === 0) return false;
      if (noProductsOnly && row.totalProductCount > 0) return false;
      return true;
    });
  }, [
    data,
    search,
    categoryFilter,
    contentFilter,
    issue,
    ownerFilter,
    dueFilter,
    staleOnly,
    healthOnly,
    noProductsOnly,
  ]);

  const stats = useMemo(() => {
    if (!data) {
      return {
        total: 0,
        publishedSections: 0,
        possibleSections: 0,
        overdue: 0,
        stale: 0,
        healthIssues: 0,
        noProducts: 0,
      };
    }
    let publishedSections = 0;
    let overdue = 0;
    let stale = 0;
    let healthIssues = 0;
    let noProducts = 0;
    for (const row of data.rows) {
      publishedSections += row.publishedSectionCount;
      if (getDueBucket(row) === "overdue") overdue += 1;
      if (isStale(row)) stale += 1;
      if (row.dataHealthFlags.length > 0) healthIssues += 1;
      if (row.totalProductCount === 0) noProducts += 1;
    }
    return {
      total: data.rows.length,
      publishedSections,
      possibleSections: data.rows.length * ADMIN_EXAM_SECTION_TYPES.length,
      overdue,
      stale,
      healthIssues,
      noProducts,
    };
  }, [data]);

  const { sorted: sortedRows, ...tableSort } = useTableSort(filteredRows, SORT_ACCESSORS);
  const sort = {
    ...tableSort,
    toggleSort: (column: ExamSortKey) => {
      tableSort.toggleSort(column);
      setPage(0);
    },
  };

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pagedRows = sortedRows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const issuePageCount = issue
    ? filteredRows.reduce((sum, row) => sum + issue.typesOf(row).length, 0)
    : 0;
  const healthRows = useMemo(
    () => (data ? data.rows.filter((r) => r.dataHealthFlags.length > 0) : []),
    [data]
  );

  const allPagedSelected = pagedRows.length > 0 && pagedRows.every((r) => selectedIds.has(r.id));

  const toggleRow = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const togglePageSelection = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPagedSelected) {
        pagedRows.forEach((r) => next.delete(r.id));
      } else {
        pagedRows.forEach((r) => next.add(r.id));
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setBulkAction("");
  };

  const applyBulkAction = () => {
    const examIds = Array.from(selectedIds);
    if (examIds.length === 0) return;

    if (bulkAction === "category" && bulkCategoryId) {
      bulkUpdateMutation.mutate(
        { examIds, categoryId: Number(bulkCategoryId) },
        { onSuccess: clearSelection }
      );
    } else if (bulkAction === "owner" && bulkOwnerTag !== undefined) {
      bulkUpdateMutation.mutate(
        { examIds, ownerTag: bulkOwnerTag },
        { onSuccess: clearSelection }
      );
    } else if (bulkAction === "due-date") {
      bulkUpdateMutation.mutate(
        { examIds, contentDueDate: bulkDueDate ?? null },
        { onSuccess: clearSelection }
      );
    }
  };

  if (isFetching && !data) {
    return (
      <div className={styles.skeletonWrap}>
        <Skeleton style={{ height: "5rem", width: "100%" }} />
        <Skeleton style={{ height: "3rem", width: "100%", marginTop: "1rem" }} />
        <Skeleton style={{ height: "20rem", width: "100%", marginTop: "1rem" }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <p>Failed to load exam dashboard: {error.message}</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className={`${styles.container} ${className || ""}`}>
      <div className={styles.statGrid}>
        <div className={styles.statCard}>
          <p className={styles.statLabel}>Total exams</p>
          <p className={styles.statValue}>{stats.total.toLocaleString()}</p>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statLabel}>Content sections published</p>
          <p className={styles.statValue}>
            {stats.publishedSections.toLocaleString()} / {stats.possibleSections.toLocaleString()}
          </p>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statLabel}>Overdue for update</p>
          <p className={`${styles.statValue} ${stats.overdue > 0 ? styles.statDanger : ""}`}>
            {stats.overdue.toLocaleString()}
          </p>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statLabel}>Stale 90+ days / untouched</p>
          <p className={`${styles.statValue} ${stats.stale > 0 ? styles.statWarning : ""}`}>
            {stats.stale.toLocaleString()}
          </p>
        </div>
        <button
          type="button"
          className={`${styles.statCard} ${styles.statCardButton}`}
          onClick={() => setShowHealthPanel((v) => !v)}
        >
          <p className={styles.statLabel}>Data health issues</p>
          <p className={`${styles.statValue} ${stats.healthIssues > 0 ? styles.statWarning : ""}`}>
            {stats.healthIssues.toLocaleString()}
          </p>
        </button>
        <button
          type="button"
          className={`${styles.statCard} ${styles.statCardButton}`}
          onClick={() => {
            setNoProductsOnly((v) => !v);
            setPage(0);
          }}
        >
          <p className={styles.statLabel}>Exams with no products tagged</p>
          <p className={`${styles.statValue} ${stats.noProducts > 0 ? styles.statWarning : ""}`}>
            {stats.noProducts.toLocaleString()}
          </p>
        </button>
      </div>

      {showHealthPanel && (
        <div className={styles.healthPanel}>
          <div className={styles.healthPanelHeader}>
            <div className={styles.healthPanelTitle}>
              <AlertTriangle size={16} />
              <span>Data health issues ({healthRows.length})</span>
            </div>
            <Button variant="ghost" size="icon-sm" onClick={() => setShowHealthPanel(false)}>
              <X size={16} />
            </Button>
          </div>
          {healthRows.length === 0 ? (
            <p className={styles.healthEmpty}>No duplicate names/slugs or missing fields found.</p>
          ) : (
            <div className={styles.healthList}>
              {healthRows.slice(0, 25).map((row) => (
                <div key={row.id} className={styles.healthRow}>
                  <div>
                    <p className={styles.healthRowName}>{row.examName}</p>
                    <p className={styles.healthRowCategory}>{row.categoryName}</p>
                  </div>
                  <div className={styles.healthFlags}>
                    {row.dataHealthFlags.map((flag) => (
                      <Badge key={flag} variant="warning">
                        {DATA_HEALTH_LABELS[flag]}
                      </Badge>
                    ))}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => onEditExam(row)}>
                    <Edit size={14} /> Fix
                  </Button>
                </div>
              ))}
              {healthRows.length > 25 && (
                <p className={styles.healthMore}>
                  +{healthRows.length - 25} more - use the "Data health" filter below to see all of them in the table.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div className={styles.filterBar}>
        <div className={styles.searchContainer}>
          <Search className={styles.searchIcon} size={18} />
          <Input
            placeholder="Search exam name, full name, or category..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
              writeSearchToUrl(e.target.value);
            }}
            className={styles.searchInput}
          />
        </div>
        <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(0); }}>
          <SelectTrigger className={styles.filterSelect}>
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {data.categories.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.categoryName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={contentFilter}
          onValueChange={(v) => {
            setPage(0);
            write({ [CONTENT_PARAM]: v === "all" ? null : v });
          }}
        >
          <SelectTrigger className={styles.filterSelect}>
            <SelectValue placeholder="Content status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any content status</SelectItem>
            <SelectItem value="complete">
              {`Complete (${ADMIN_EXAM_SECTION_TYPES.length}/${ADMIN_EXAM_SECTION_TYPES.length})`}
            </SelectItem>
            <SelectItem value="in-progress">In progress</SelectItem>
            <SelectItem value="not-started">Not started</SelectItem>
            <SelectSeparator />
            <SelectItem value={READY_FOR_REVIEW_FILTER}>Ready for review</SelectItem>
          </SelectContent>
        </Select>
        <Select value={ownerFilter} onValueChange={(v) => { setOwnerFilter(v); setPage(0); }}>
          <SelectTrigger className={styles.filterSelect}>
            <SelectValue placeholder="Owner" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any owner</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {owners.map((owner) => (
              <SelectItem key={owner} value={owner}>
                {owner}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={dueFilter} onValueChange={(v) => { setDueFilter(v); setPage(0); }}>
          <SelectTrigger className={styles.filterSelect}>
            <SelectValue placeholder="Due date" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any due status</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="due-soon">Due soon</SelectItem>
            <SelectItem value="upcoming">Upcoming</SelectItem>
            <SelectItem value="none">No due date</SelectItem>
          </SelectContent>
        </Select>
        <button
          type="button"
          className={`${styles.toggleChip} ${staleOnly ? styles.toggleChipActive : ""}`}
          onClick={() => { setStaleOnly((v) => !v); setPage(0); }}
        >
          Stale 90+ days
        </button>
        <button
          type="button"
          className={`${styles.toggleChip} ${healthOnly ? styles.toggleChipActive : ""}`}
          onClick={() => { setHealthOnly((v) => !v); setPage(0); }}
        >
          Data health issues
        </button>
        <button
          type="button"
          className={`${styles.toggleChip} ${noProductsOnly ? styles.toggleChipActive : ""}`}
          onClick={() => { setNoProductsOnly((v) => !v); setPage(0); }}
        >
          No products tagged
        </button>
        <Button onClick={onAddExam} className={styles.addExamButton}>
          Add exam
        </Button>
      </div>

      {issue && (
        <ConsoleFilterNotice
          label={`${issue.label} - ${countOf(issuePageCount, "page")} in ${countOf(filteredRows.length, "exam")}`}
          onClear={() => write({ [FILTER_PARAM]: null })}
          clearLabel="Show all"
        />
      )}

      {selectedIds.size > 0 && (
        <div className={styles.bulkBar}>
          <span className={styles.bulkCount}>{selectedIds.size} selected</span>
          <Select value={bulkAction} onValueChange={(v) => setBulkAction(v as typeof bulkAction)}>
            <SelectTrigger className={styles.bulkActionSelect}>
              <SelectValue placeholder="Bulk action..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="category">Change category</SelectItem>
              <SelectItem value="owner">Assign owner</SelectItem>
              <SelectItem value="due-date">Set content due date</SelectItem>
            </SelectContent>
          </Select>

          {bulkAction === "category" && (
            <Select value={bulkCategoryId} onValueChange={setBulkCategoryId}>
              <SelectTrigger className={styles.bulkValueSelect}>
                <SelectValue placeholder="New category" />
              </SelectTrigger>
              <SelectContent>
                {data.categories.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.categoryName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {bulkAction === "owner" && (
            <AdminOwnerSelect
              value={bulkOwnerTag}
              onChange={setBulkOwnerTag}
              placeholder="New owner"
              className={styles.bulkValueSelect}
            />
          )}
          {bulkAction === "due-date" && (
            <DatePicker value={bulkDueDate} onChange={setBulkDueDate} showTime={false} />
          )}

          <Button
            size="sm"
            onClick={applyBulkAction}
            disabled={!bulkAction || bulkUpdateMutation.isPending}
          >
            {bulkUpdateMutation.isPending ? "Applying..." : "Apply"}
          </Button>
          <Button variant="ghost" size="sm" onClick={clearSelection}>
            Cancel
          </Button>
        </div>
      )}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.checkboxCell}>
                <Checkbox checked={allPagedSelected} onChange={togglePageSelection} />
              </th>
              <SortableTh column="exam" sort={sort}>Exam</SortableTh>
              <SortableTh column="category" sort={sort}>Category</SortableTh>
              <SortableTh column="content" sort={sort}>Content ({ADMIN_EXAM_SECTION_TYPES.length} sections)</SortableTh>
              <SortableTh column="products" sort={sort}>Products</SortableTh>
              <SortableTh column="owner" sort={sort}>Owner</SortableTh>
              <SortableTh column="updated" sort={sort}>Content updated</SortableTh>
              <SortableTh column="due" sort={sort}>Due</SortableTh>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pagedRows.length === 0 && (
              <tr>
                <td colSpan={9} className={styles.emptyRow}>
                  No exams match the current filters.
                </td>
              </tr>
            )}
            {pagedRows.map((row) => {
              const dueBucket = getDueBucket(row);
              const stale = isStale(row);
              const issueTypes = issue ? issue.typesOf(row) : [];
              const editorSection = issueTypes[0];
              return (
                <tr key={row.id}>
                  <td className={styles.checkboxCell}>
                    <Checkbox
                      checked={selectedIds.has(row.id)}
                      onChange={() => toggleRow(row.id)}
                    />
                  </td>
                  <td>
                    <p className={styles.examName}>{row.examName}</p>
                    <p className={styles.examFullName}>{row.fullName}</p>
                    {row.dataHealthFlags.length > 0 && (
                      <span className={styles.healthDot} title={row.dataHealthFlags.map((f) => DATA_HEALTH_LABELS[f]).join(", ")} />
                    )}
                  </td>
                  <td className={styles.categoryCell}>{row.categoryName}</td>
                  <td>
                    <div className={styles.dots}>
                      {ADMIN_EXAM_SECTION_TYPES.map((type) => {
                        const readyForReview = row.readyForReviewTypes.includes(type);
                        return (
                          <span
                            key={type}
                            className={`${styles.dot} ${styles[`dot_${row.contentStatusByType[type]}`]} ${readyForReview ? styles.dotReview : ""}`}
                            title={`${ADMIN_EXAM_SECTION_META[type].label}: ${row.contentStatusByType[type]}${readyForReview ? ", ready for review" : ""}`}
                          />
                        );
                      })}
                    </div>
                    <p className={styles.dotsCaption}>
                      {row.publishedSectionCount}/{row.totalSectionCount} published
                    </p>
                    {row.readyForReviewTypes.length > 0 && (
                      <p className={styles.reviewCaption}>
                        {row.readyForReviewTypes.length} ready for review
                      </p>
                    )}
                    {issue && issueTypes.length > 0 && (
                      <p className={styles.issueCaption}>
                        <span className={styles.issueLabel}>{issue.rowLabel}:</span>{" "}
                        {issueTypes.map((type) => humanisePageType(type)).join(", ")}
                      </p>
                    )}
                  </td>
                  <td
                    className={styles.productsCell}
                    title={`${row.mockTestCount} mock test${row.mockTestCount === 1 ? "" : "s"} / live competitions, ${row.digitalProductCount} digital product${row.digitalProductCount === 1 ? "" : "s"}`}
                  >
                    {row.totalProductCount === 0 ? (
                      <span className={styles.unassigned}>0</span>
                    ) : (
                      row.totalProductCount
                    )}
                  </td>
                  <td className={styles.ownerCell}>
                    {row.ownerTag ? row.ownerTag : <span className={styles.unassigned}>Unassigned</span>}
                  </td>
                  <td className={styles.updatedCell}>
                    {stale && (
                      <Badge variant="warning" className={styles.staleBadge}>
                        Stale
                      </Badge>
                    )}
                    {row.lastContentUpdatedAt
                      ? new Date(row.lastContentUpdatedAt).toLocaleDateString()
                      : "Never"}
                  </td>
                  <td className={styles.dueCell}>
                    {dueBucket === "overdue" && (
                      <Badge variant="destructive">Overdue</Badge>
                    )}
                    {dueBucket === "due-soon" && (
                      <Badge variant="warning">Due soon</Badge>
                    )}
                    {dueBucket === "upcoming" && row.contentDueDate && (
                      <span className={styles.dueDate}>
                        {new Date(row.contentDueDate).toLocaleDateString()}
                      </span>
                    )}
                    {dueBucket === "none" && <span className={styles.unassigned}>-</span>}
                  </td>
                  <td className={styles.actionsCell}>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="Preview the public exam page"
                      aria-label={`Preview ${row.examName}`}
                      asChild
                    >
                      <a href={`/exams/${row.examSlug}`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink size={16} />
                      </a>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title={
                        editorSection
                          ? `Open the ${humanisePageType(editorSection)} section in the content editor`
                          : "Manage this exam's page content"
                      }
                      asChild
                    >
                      <Link
                        to={
                          editorSection
                            ? `/admin/exam-content/${row.id}?section=${editorSection}`
                            : `/admin/exam-content/${row.id}`
                        }
                      >
                        <FileText size={16} />
                      </Link>
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => onEditExam(row)}>
                      <Edit size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className={styles.deleteButton}
                      onClick={() => onDeleteExam(row)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filteredRows.length > 0 && (
        <div className={styles.pagination}>
          <p className={styles.paginationInfo}>
            {page * PAGE_SIZE + 1}
            {"–"}
            {Math.min((page + 1) * PAGE_SIZE, filteredRows.length)} of {filteredRows.length}
          </p>
          <div className={styles.paginationControls}>
            <Button
              variant="outline"
              size="icon-sm"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft size={16} />
            </Button>
            <span className={styles.paginationPage}>
              Page {page + 1} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
