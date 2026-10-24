import React, { useMemo, useState } from "react";
import Papa from "papaparse";
import { AlertCircle, FileSpreadsheet, ReceiptText, Search, Tag } from "lucide-react";
import { useAdminPromoAnalyticsQuery } from "../helpers/useAdminPromoAnalytics";
import {
  PromoAnalyticsRange,
  PromoCodeAnalyticsRow,
} from "../endpoints/admin/orders/promo-analytics_GET.schema";
import { useTableSort, SortAccessors } from "../helpers/useTableSort";
import { SortableTh } from "./SortableTh";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Input } from "./Input";
import { Switch } from "./Switch";
import { Skeleton } from "./Skeleton";
import { ConsoleListEmpty } from "./ConsoleListEmpty";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./Select";
import styles from "./AdminPromoAnalytics.module.css";

const RANGE_LABELS: Record<PromoAnalyticsRange, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  "365d": "Last 12 months",
  all: "All time",
};

type OwnerFilter = "all" | "admin" | "teacher";
type CodeStatus = "Active" | "Inactive" | "Expired" | "Scheduled" | "Limit reached";

const STATUS_VARIANTS: Record<CodeStatus, "success" | "secondary" | "outline" | "warning"> = {
  Active: "success",
  Inactive: "secondary",
  Expired: "outline",
  Scheduled: "warning",
  "Limit reached": "warning",
};

const APPLIES_TO_LABELS: Record<string, string> = {
  all: "All items",
  tests: "Test series",
  courses: "Courses",
  digital_products: "Study notes",
  bundles: "Bundles",
  live_tests: "Live tests",
};

const codeStatus = (row: PromoCodeAnalyticsRow, now: number): CodeStatus => {
  if (!row.isActive) return "Inactive";
  if (row.validUntil && new Date(row.validUntil).getTime() <= now) return "Expired";
  if (row.validFrom && new Date(row.validFrom).getTime() > now) return "Scheduled";
  if (row.usageLimit !== null && row.usesHeld >= row.usageLimit) return "Limit reached";
  return "Active";
};

const rupees = (value: number) =>
  `₹${value.toLocaleString("en-IN", { maximumFractionDigits: value % 1 === 0 ? 0 : 2 })}`;

const percent = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : "-");

const conversion = (row: PromoCodeAnalyticsRow) => (row.attempts > 0 ? row.completed / row.attempts : null);

const formatDay = (date: Date | null) =>
  date ? new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : null;

const discountLabel = (row: PromoCodeAnalyticsRow) =>
  row.discountType === "percentage" ? `${row.discountValue}% off` : `${rupees(row.discountValue)} off`;

const ownerLabel = (row: PromoCodeAnalyticsRow) => (row.ownerType === "admin" ? "Testkart" : row.ownerName ?? "Teacher");

type SortKey = "code" | "orders" | "conversion" | "revenue" | "discount" | "last";

const SORT_ACCESSORS: SortAccessors<PromoCodeAnalyticsRow, SortKey> = {
  code: (r) => r.code,
  orders: (r) => r.completed,
  conversion: (r) => conversion(r),
  revenue: (r) => r.revenue,
  discount: (r) => r.discountGiven,
  last: (r) => (r.lastOrderAt ? new Date(r.lastOrderAt) : null),
};

interface AdminPromoAnalyticsProps {
  onViewOrders: (code: string) => void;
}

export const AdminPromoAnalytics: React.FC<AdminPromoAnalyticsProps> = ({ onViewOrders }) => {
  const [range, setRange] = useState<PromoAnalyticsRange>("30d");
  const [owner, setOwner] = useState<OwnerFilter>("all");
  const [search, setSearch] = useState("");
  const [showUnused, setShowUnused] = useState(false);
  const { data, isFetching, isError, error, dataUpdatedAt } = useAdminPromoAnalyticsQuery(range);

  const rows = useMemo(() => {
    if (!data) return [];
    const term = search.trim().toLowerCase();
    return data.codes.filter((row) => {
      if (!showUnused && row.attempts === 0) return false;
      if (owner !== "all" && row.ownerType !== owner) return false;
      if (term) {
        const haystack = `${row.code} ${ownerLabel(row)} ${row.description ?? ""}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [data, search, owner, showUnused]);

  const { sorted, ...sort } = useTableSort<PromoCodeAnalyticsRow, SortKey>(rows, SORT_ACCESSORS, {
    sortBy: "revenue",
    sortOrder: "desc",
  });
  const now = dataUpdatedAt || Date.now();

  const exportCsv = () => {
    const csv = Papa.unparse(
      sorted.map((row) => ({
        Code: row.code,
        Owner: ownerLabel(row),
        "Applies to": APPLIES_TO_LABELS[row.appliesTo] ?? row.appliesTo,
        Discount: discountLabel(row),
        Status: codeStatus(row, now),
        "Checkout attempts": row.attempts,
        "Completed orders": row.completed,
        "Paid orders": row.paidCompleted,
        "Free orders": row.freeCompleted,
        Failed: row.failed,
        Cancelled: row.cancelled,
        Refunded: row.refunded,
        "Conversion (%)": row.attempts > 0 ? Math.round((row.completed / row.attempts) * 100) : "",
        "Revenue (Rs.)": row.revenue.toFixed(2),
        "Discount given (Rs.)": row.discountGiven.toFixed(2),
        Students: row.students,
        "Lifetime uses": row.usesHeld,
        "Use limit": row.usageLimit ?? "",
        "Last order": formatDay(row.lastOrderAt) ?? "",
      }))
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Promo_Code_Performance_${range}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const renderTiles = () => {
    if (!data) {
      return (
        <div className={styles.tiles}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={styles.tile}>
              <Skeleton style={{ height: "0.75rem", width: "60%" }} />
              <Skeleton style={{ height: "1.5rem", width: "45%" }} />
              <Skeleton style={{ height: "0.75rem", width: "70%" }} />
            </div>
          ))}
        </div>
      );
    }
    const s = data.summary;
    const tiles = [
      {
        label: "Paid orders with a promo",
        value: s.paidCompleted.toLocaleString("en-IN"),
        note: `${percent(s.paidCompleted, s.paidOrdersAll)} of ${s.paidOrdersAll.toLocaleString("en-IN")} paid orders`,
      },
      {
        label: "Revenue from promo orders",
        value: rupees(s.revenue),
        note: `${percent(s.revenue, s.paidRevenueAll)} of paid revenue`,
      },
      {
        label: "Discount given",
        value: rupees(s.discountGiven),
        note: s.completed > 0 ? `${rupees(Math.round(s.discountGiven / s.completed))} per completed order` : "No completed orders",
      },
      {
        label: "Checkout conversion",
        value: percent(s.completed, s.attempts),
        note: `${s.completed.toLocaleString("en-IN")} of ${s.attempts.toLocaleString("en-IN")} checkouts completed`,
      },
      {
        label: "Students reached",
        value: s.students.toLocaleString("en-IN"),
        note: `${s.freeCompleted.toLocaleString("en-IN")} orders made free by a code`,
      },
      {
        label: "Codes used",
        value: s.codesUsed.toLocaleString("en-IN"),
        note: `${s.activeCodes.toLocaleString("en-IN")} of ${s.totalCodes.toLocaleString("en-IN")} codes redeemable now`,
      },
    ];
    return (
      <div className={styles.tiles}>
        {tiles.map((tile) => (
          <div key={tile.label} className={styles.tile}>
            <span className={styles.tileLabel}>{tile.label}</span>
            <span className={styles.tileValue}>{tile.value}</span>
            <span className={styles.tileNote}>{tile.note}</span>
          </div>
        ))}
      </div>
    );
  };

  const renderStatus = (row: PromoCodeAnalyticsRow) => {
    const status = codeStatus(row, now);
    return (
      <div className={styles.stack}>
        <Badge variant={STATUS_VARIANTS[status]} className={styles.flag}>
          {status}
        </Badge>
        <span className={styles.secondaryLine}>
          {row.usageLimit !== null ? `${row.usesHeld} / ${row.usageLimit} used` : `${row.usesHeld} used`}
        </span>
      </div>
    );
  };

  const viewButton = (row: PromoCodeAnalyticsRow) => (
    <Button
      variant="outline"
      size="sm"
      onClick={() => onViewOrders(row.code)}
      disabled={row.attempts === 0 && row.usesHeld === 0}
      aria-label={`View transactions that used ${row.code}`}
    >
      <ReceiptText size={14} aria-hidden="true" />
      Orders
    </Button>
  );

  const renderResults = () => {
    if (isError) {
      return (
        <ConsoleListEmpty
          tone="error"
          icon={<AlertCircle size={24} />}
          title="Failed to load promo code analytics"
          description={error instanceof Error ? error.message : "Please try again later."}
        />
      );
    }
    if (!data) {
      return (
        <div className={styles.cardsContainer}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={styles.card}>
              <Skeleton style={{ height: "1rem", width: "8rem" }} />
              <Skeleton style={{ height: "2rem", width: "100%" }} />
            </div>
          ))}
        </div>
      );
    }
    if (sorted.length === 0) {
      return (
        <ConsoleListEmpty
          icon={<Tag size={24} />}
          title={showUnused ? "No promo codes match" : `No promo code orders in ${RANGE_LABELS[range].toLowerCase()}`}
          description={showUnused ? "Try a different search or owner." : "Turn on Show unused codes to see every code."}
        />
      );
    }

    return (
      <>
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <colgroup>
              <col />
              <col className={styles.colDiscount} />
              <col className={styles.colNum} />
              <col className={styles.colNum} />
              <col className={styles.colMoney} />
              <col className={styles.colMoney} />
              <col className={styles.colDate} />
              <col className={styles.colStatus} />
              <col className={styles.colAction} />
            </colgroup>
            <thead>
              <tr>
                <SortableTh column="code" sort={sort}>Code</SortableTh>
                <th>Discount</th>
                <SortableTh column="orders" sort={sort} className={styles.num}>Orders</SortableTh>
                <SortableTh column="conversion" sort={sort} className={styles.num}>Conversion</SortableTh>
                <SortableTh column="revenue" sort={sort} className={styles.num}>Revenue</SortableTh>
                <SortableTh column="discount" sort={sort} className={styles.num}>Discount given</SortableTh>
                <SortableTh column="last" sort={sort}>Last order</SortableTh>
                <th>Status</th>
                <th><span className={styles.srOnly}>Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => {
                const rate = conversion(row);
                const owner = `${ownerLabel(row)}, ${APPLIES_TO_LABELS[row.appliesTo] ?? row.appliesTo}`;
                return (
                  <tr key={row.id}>
                    <td>
                      <div className={styles.stack}>
                        <span className={styles.codeLine} title={row.code}>{row.code}</span>
                        <span className={styles.secondaryLine} title={owner}>{owner}</span>
                      </div>
                    </td>
                    <td>
                      <div className={styles.stack}>
                        <span className={styles.valueLine}>{discountLabel(row)}</span>
                        <span className={styles.secondaryLine}>
                          {row.maxDiscountAmount !== null ? `Up to ${rupees(row.maxDiscountAmount)}` : row.isPublic ? "Public" : "Private"}
                        </span>
                      </div>
                    </td>
                    <td className={styles.num}>
                      <div className={styles.stack}>
                        <span className={styles.valueLine}>{row.completed.toLocaleString("en-IN")}</span>
                        <span className={styles.secondaryLine}>
                          {row.paidCompleted} paid, {row.freeCompleted} free
                        </span>
                      </div>
                    </td>
                    <td className={styles.num}>
                      <div className={styles.stack}>
                        <span className={styles.valueLine}>{rate === null ? "-" : `${Math.round(rate * 100)}%`}</span>
                        <span className={styles.secondaryLine}>{row.failed + row.cancelled} dropped</span>
                      </div>
                    </td>
                    <td className={styles.num}>
                      <div className={styles.stack}>
                        <span className={styles.valueLine}>{rupees(row.revenue)}</span>
                        <span className={styles.secondaryLine}>{row.students} students</span>
                      </div>
                    </td>
                    <td className={`${styles.num} ${styles.valueLine}`}>{rupees(row.discountGiven)}</td>
                    <td>{formatDay(row.lastOrderAt) ?? <span className={styles.emptyLine}>None</span>}</td>
                    <td>{renderStatus(row)}</td>
                    <td className={styles.actionCell}>{viewButton(row)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className={styles.cardsContainer}>
          {sorted.map((row) => {
            const rate = conversion(row);
            return (
              <article key={row.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={styles.stack}>
                    <span className={styles.codeLine}>{row.code}</span>
                    <span className={styles.secondaryLine}>
                      {ownerLabel(row)}, {discountLabel(row)}
                    </span>
                  </div>
                  {renderStatus(row)}
                </div>
                <dl className={styles.cardStats}>
                  <div className={styles.cardStat}><dt>Orders</dt><dd>{row.completed} ({row.paidCompleted} paid)</dd></div>
                  <div className={styles.cardStat}><dt>Conversion</dt><dd>{rate === null ? "-" : `${Math.round(rate * 100)}%`}</dd></div>
                  <div className={styles.cardStat}><dt>Revenue</dt><dd>{rupees(row.revenue)}</dd></div>
                  <div className={styles.cardStat}><dt>Discount given</dt><dd>{rupees(row.discountGiven)}</dd></div>
                  <div className={styles.cardStat}><dt>Students</dt><dd>{row.students}</dd></div>
                  <div className={styles.cardStat}><dt>Last order</dt><dd>{formatDay(row.lastOrderAt) ?? "None"}</dd></div>
                </dl>
                <div className={styles.cardFooter}>{viewButton(row)}</div>
              </article>
            );
          })}
        </div>
      </>
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <div className={styles.searchWrapper}>
          <Search size={16} className={styles.searchIcon} aria-hidden="true" />
          <Input
            type="search"
            placeholder="Code, teacher or note..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
            aria-label="Search promo codes"
          />
        </div>
        <Select value={range} onValueChange={(value) => setRange(value as PromoAnalyticsRange)}>
          <SelectTrigger className={styles.select} aria-label="Date range">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(RANGE_LABELS) as PromoAnalyticsRange[]).map((key) => (
              <SelectItem key={key} value={key}>{RANGE_LABELS[key]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={owner} onValueChange={(value) => setOwner(value as OwnerFilter)}>
          <SelectTrigger className={styles.select} aria-label="Code owner">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All codes</SelectItem>
            <SelectItem value="admin">Testkart codes</SelectItem>
            <SelectItem value="teacher">Teacher codes</SelectItem>
          </SelectContent>
        </Select>
        <label className={styles.switchLabel}>
          <Switch checked={showUnused} onCheckedChange={setShowUnused} />
          Show unused codes
        </label>
        <Button variant="outline" onClick={exportCsv} disabled={sorted.length === 0} className={styles.exportButton}>
          <FileSpreadsheet size={16} />
          Download CSV
        </Button>
      </div>

      {renderTiles()}

      <div className={styles.resultsHeader}>
        <p className={styles.resultsCount}>
          {data ? (
            <>
              <strong>{sorted.length}</strong> {sorted.length === 1 ? "code" : "codes"}, orders placed in{" "}
              {RANGE_LABELS[range].toLowerCase()}
              {isFetching && " (updating)"}
            </>
          ) : (
            "Loading promo codes..."
          )}
        </p>
        <p className={styles.resultsHint}>Revenue and discount count completed orders only. Subscription codes are on the Subscriptions page.</p>
      </div>

      <div className={styles.results}>{renderResults()}</div>
    </div>
  );
};