import React from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowUp, Package } from "lucide-react";
import { Skeleton } from "./Skeleton";
import { Button } from "./Button";
import { ConsoleListEmpty } from "./ConsoleListEmpty";
import { ConsoleListPagination } from "./ConsoleListPagination";
import { TeacherAnalyticsPanel } from "./TeacherAnalyticsPanel";
import { TeacherAnalyticsBarList } from "./TeacherAnalyticsBarList";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./Select";
import type { AnalyticsRange } from "../helpers/teacherAnalyticsTime";
import {
  AnalyticsProductKind,
  AnalyticsProductKindValues,
  AnalyticsProductRow,
  AnalyticsProductSort,
  AnalyticsProductSortValues,
} from "../endpoints/teacher/analytics/products_GET.schema";
import { useTeacherAnalyticsProducts } from "../helpers/useTeacherAnalytics";
import { useListUrlParams } from "../helpers/useListUrlParams";
import { adminFormat } from "../helpers/adminFormat";
import {
  ANALYTICS_KIND_LABELS,
  ANALYTICS_KIND_PLURALS,
  ANALYTICS_RANGE_LABELS,
  analyticsEditHref,
  percent,
} from "../helpers/teacherAnalyticsLabels";
import styles from "./TeacherAnalyticsProducts.module.css";

type Props = { range: AnalyticsRange; enabled: boolean };

type Column = {
  sort: AnalyticsProductSort;
  label: string;
  numeric: boolean;
  render: (row: AnalyticsProductRow) => React.ReactNode;
};

const dash = <span className={styles.none}>-</span>;

const COLUMNS: Column[] = [
  {
    sort: "title",
    label: "Content",
    numeric: false,
    render: (row) => (
      <span className={styles.content}>
        <Link to={analyticsEditHref(row.kind, row.id)} className={styles.title} title={row.title}>
          {row.title}
        </Link>
        <span className={styles.kind}>
          {ANALYTICS_KIND_LABELS[row.kind]}
          {!row.live && <span className={styles.offSale}>Not on sale</span>}
        </span>
      </span>
    ),
  },
  {
    sort: "visitors",
    label: "Visitors",
    numeric: true,
    render: (row) => (
      <span className={styles.stackedNum}>
        {adminFormat.count(row.visitors)}
        {row.lifetimeViews !== null && row.lifetimeViews > 0 && (
          <span className={styles.subNum}>{adminFormat.count(row.lifetimeViews)} all time</span>
        )}
      </span>
    ),
  },
  {
    sort: "conversion",
    label: "Conversion",
    numeric: true,
    render: (row) => (row.conversion === null ? dash : percent(row.conversion)),
  },
  { sort: "paidUnits", label: "Sold", numeric: true, render: (row) => adminFormat.count(row.paidUnits) },
  { sort: "freeUnits", label: "Free", numeric: true, render: (row) => adminFormat.count(row.freeUnits) },
  { sort: "gross", label: "Gross", numeric: true, render: (row) => adminFormat.inr(row.gross) },
  { sort: "net", label: "Your earnings", numeric: true, render: (row) => adminFormat.inr(row.net) },
  { sort: "refunds", label: "Refunds", numeric: true, render: (row) => (row.refunds > 0 ? adminFormat.count(row.refunds) : dash) },
  {
    sort: "enrolments",
    label: "Enrolments",
    numeric: true,
    render: (row) => (row.enrolments === null ? dash : adminFormat.count(row.enrolments)),
  },
  {
    sort: "rating",
    label: "Rating",
    numeric: true,
    render: (row) =>
      row.rating === null ? (
        dash
      ) : (
        <span className={styles.rating}>
          {row.rating.toFixed(1)}
          <span className={styles.ratingCount}>({adminFormat.count(row.ratingCount)})</span>
        </span>
      ),
  },
  {
    sort: "completion",
    label: "Completion",
    numeric: true,
    render: (row) => (row.completion === null ? dash : percent(row.completion)),
  },
];

const DEFAULT_SORT: AnalyticsProductSort = "net";

export const TeacherAnalyticsProducts = ({ range, enabled }: Props) => {
  const { read, readId, write } = useListUrlParams();
  const kind = read<AnalyticsProductKind>("kind", AnalyticsProductKindValues, "all");
  const sort = read<AnalyticsProductSort>("sort", AnalyticsProductSortValues, DEFAULT_SORT);
  const dir = read<"asc" | "desc">("dir", ["asc", "desc"], sort === "title" ? "asc" : "desc");
  const page = readId("page") ?? 1;

  const { data, isFetching, isError, error, refetch } = useTeacherAnalyticsProducts(
    { range, kind, sort, dir, page },
    enabled
  );
  const rangeLabel = ANALYTICS_RANGE_LABELS[data?.range ?? range];

  const setSort = (next: AnalyticsProductSort) => {
    if (next === sort) {
      write({ dir: dir === "asc" ? "desc" : "asc", page: null });
      return;
    }
    write({ sort: next === DEFAULT_SORT ? null : next, dir: null, page: null });
  };

  if (isError && !data) {
    return (
      <ConsoleListEmpty
        tone="error"
        icon={<Package size={22} />}
        title="Products could not be loaded"
        description={error instanceof Error ? error.message : "Try again in a moment."}
      >
        <Button variant="outline" onClick={() => refetch()}>
          Try again
        </Button>
      </ConsoleListEmpty>
    );
  }

  if (!data) {
    return (
      <div className={styles.stack} aria-busy="true">
        <Skeleton style={{ height: "14rem", width: "100%", borderRadius: "var(--radius-md)" }} />
        <Skeleton style={{ height: "24rem", width: "100%", borderRadius: "var(--radius-md)" }} />
      </div>
    );
  }

  if (data.kindCounts.all === 0) {
    return (
      <ConsoleListEmpty
        icon={<Package size={22} />}
        title="Nothing on sale yet"
        description="Publish a test series, course or study notes and its sales, enrolments and ratings show up here."
      >
        <Button asChild>
          <Link to="/teacher/test-series">Go to test series</Link>
        </Button>
      </ConsoleListEmpty>
    );
  }

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const kindOptions = AnalyticsProductKindValues.filter((value) => value === "all" || data.kindCounts[value] > 0);

  return (
    <div className={`${styles.stack} ${isFetching ? styles.busy : ""}`.trim()} aria-busy={isFetching}>
      <TeacherAnalyticsPanel
        title="Top earners"
        subtitle={`your earnings, last ${rangeLabel}`}
        table={{
          caption: "Top earners",
          columns: ["Content", "Type", "Your earnings", "Gross"],
          rows: data.top.map((row) => [row.title, ANALYTICS_KIND_LABELS[row.kind], adminFormat.inr(row.net), adminFormat.inr(row.gross)]),
        }}
      >
        {data.top.length === 0 ? (
          <p className={styles.empty}>No paid sales in the last {rangeLabel}.</p>
        ) : (
          <TeacherAnalyticsBarList
            rows={data.top.map((row) => ({
              key: `${row.kind}:${row.id}`,
              label: row.title,
              meta: ANALYTICS_KIND_LABELS[row.kind],
              value: row.net,
              display: adminFormat.inr(row.net),
              href: analyticsEditHref(row.kind, row.id),
            }))}
          />
        )}
      </TeacherAnalyticsPanel>

      <TeacherAnalyticsPanel
        title="All content"
        subtitle={`sales and enrolments for the last ${rangeLabel}; rating and completion are all time`}
        actions={
          <Select value={kind} onValueChange={(value) => write({ kind: value === "all" ? null : value, page: null })}>
            <SelectTrigger className={styles.kindSelect} aria-label="Content type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {kindOptions.map((value) => (
                <SelectItem key={value} value={value}>
                  {value === "all" ? "All types" : ANALYTICS_KIND_PLURALS[value]} ({adminFormat.count(data.kindCounts[value])})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      >
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                {COLUMNS.map((column) => {
                  const active = column.sort === sort;
                  return (
                    <th
                      key={column.sort}
                      scope="col"
                      className={column.numeric ? styles.num : undefined}
                      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
                    >
                      <button
                        type="button"
                        className={`${styles.sortButton} ${active ? styles.sortActive : ""}`.trim()}
                        onClick={() => setSort(column.sort)}
                      >
                        {column.label}
                        {active &&
                          (dir === "asc" ? (
                            <ArrowUp size={12} aria-hidden="true" />
                          ) : (
                            <ArrowDown size={12} aria-hidden="true" />
                          ))}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={`${row.kind}:${row.id}`}>
                  {COLUMNS.map((column) => (
                    <td key={column.sort} className={column.numeric ? styles.num : undefined}>
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={styles.footnote}>
          Visitors are people who opened the item's page in the period (counted from launch); "all time" is the older
          page-load counter. Conversion is items sold or claimed per 100 visitors. Completion is finished papers out of
          started ones for tests, and average progress for courses. Study notes have no enrolment apart from the
          purchase.
        </p>
        {totalPages > 1 && (
          <ConsoleListPagination
            page={data.page}
            totalPages={totalPages}
            onPageChange={(next) => write({ page: next > 1 ? next : null })}
          />
        )}
      </TeacherAnalyticsPanel>
    </div>
  );
};