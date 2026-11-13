import React, { useState } from "react";
import { Helmet } from "react-helmet";
import { AlertTriangle, Eye, History } from "lucide-react";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { Input } from "../components/Input";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/Tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/Select";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { ConsoleListToolbar, consoleToolbarControlClass } from "../components/ConsoleListToolbar";
import { ConsoleListEmpty } from "../components/ConsoleListEmpty";
import { ConsoleListPagination } from "../components/ConsoleListPagination";
import { AdminFacetSelect } from "../components/AdminFacetSelect";
import { PriceDelta } from "../components/AdminPriceChange";
import { AdminPriceHistorySheet, type PriceHistoryTarget } from "../components/AdminPriceHistorySheet";
import { useAdminPriceHistoryQuery } from "../helpers/useAdminPriceHistory";
import { useListPage } from "../helpers/useListPage";
import { useListUrlParams } from "../helpers/useListUrlParams";
import {
  formatChangedAtExact,
  formatHistoryPrice,
  PRICE_HISTORY_PRODUCT_TYPES,
  PRICE_HISTORY_TYPE_LABELS,
  PRICE_MOVEMENTS,
  PRICE_MOVEMENT_LABELS,
  type PriceHistoryProductType,
  type PriceMovement,
} from "../helpers/productPriceHistory";
import type { PriceHistoryEntry } from "../endpoints/admin/price-history/list_GET.schema";
import styles from "./admin.price-history.module.css";

const TYPE_TABS = ["all", ...PRICE_HISTORY_PRODUCT_TYPES] as const;
type TypeTab = (typeof TYPE_TABS)[number];
const ANY = "any";

const dayFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
const timeFormat = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });

const TableColumns = () => (
  <colgroup>
    <col />
    <col className={styles.colType} />
    <col className={styles.colTeacher} />
    <col className={styles.colMoney} />
    <col className={styles.colMoney} />
    <col className={styles.colChange} />
    <col className={styles.colDate} />
    <col className={styles.colActions} />
  </colgroup>
);

const RowSkeleton = () => (
  <tr>
    <td><Skeleton style={{ height: "0.875rem", width: "70%" }} /></td>
    <td><Skeleton style={{ height: "0.875rem", width: "4.5rem" }} /></td>
    <td><Skeleton style={{ height: "0.875rem", width: "6rem" }} /></td>
    <td><Skeleton style={{ height: "0.875rem", width: "3rem", marginLeft: "auto" }} /></td>
    <td><Skeleton style={{ height: "0.875rem", width: "3rem", marginLeft: "auto" }} /></td>
    <td><Skeleton style={{ height: "0.875rem", width: "4rem", marginLeft: "auto" }} /></td>
    <td><Skeleton style={{ height: "0.875rem", width: "5rem" }} /></td>
    <td><Skeleton style={{ height: "1.5rem", width: "1.5rem", marginLeft: "auto" }} /></td>
  </tr>
);

export default function AdminPriceHistoryPage() {
  const { read, readId, write } = useListUrlParams();
  const typeTab = read<TypeTab>("type", TYPE_TABS, "all");
  const teacherId = readId("teacher");
  const [search, setSearch] = useState("");
  const [movement, setMovement] = useState<PriceMovement | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [target, setTarget] = useState<PriceHistoryTarget | null>(null);
  const [page, setPage] = useListPage(JSON.stringify([typeTab, teacherId, search, movement, from, to, sort]));

  const rangeInverted = from !== "" && to !== "" && from > to;
  const { data, isError, error, refetch, isPlaceholderData } = useAdminPriceHistoryQuery({
    page,
    search: search || undefined,
    productType: typeTab === "all" ? undefined : typeTab,
    teacherId: teacherId ?? undefined,
    movement: movement || undefined,
    from: rangeInverted ? to : from || undefined,
    to: rangeInverted ? from : to || undefined,
    sort,
  });
  const entries = isPlaceholderData ? undefined : data?.items;

  const permittedTypes: PriceHistoryProductType[] = data?.productTypes ?? [];
  const tabs = [
    { value: "all", label: "All" },
    ...permittedTypes.map((type) => ({ value: type, label: PRICE_HISTORY_TYPE_LABELS[type] })),
  ];

  const hasFilters = search !== "" || typeTab !== "all" || teacherId !== null || movement !== "" || from !== "" || to !== "";
  const clearFilters = () => {
    setSearch("");
    setMovement("");
    setFrom("");
    setTo("");
    write({ type: null, teacher: null });
  };

  const openEntry = (entry: PriceHistoryEntry) =>
    setTarget({ productType: entry.productType, productId: entry.productId, entry });

  const renderChangedAt = (date: Date) => (
    <span className={styles.stack} title={formatChangedAtExact(date)}>
      <span>{dayFormat.format(new Date(date))}</span>
      <span className={styles.secondaryLine}>{timeFormat.format(new Date(date))}</span>
    </span>
  );

  const renderAction = (entry: PriceHistoryEntry) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-md"
          className={styles.iconButton}
          aria-label={`View details of the price change on ${entry.productTitle}`}
          onClick={() => openEntry(entry)}
        >
          <Eye />
        </Button>
      </TooltipTrigger>
      <TooltipContent>View details</TooltipContent>
    </Tooltip>
  );

  const renderContent = () => {
    if (isError) {
      return (
        <ConsoleListEmpty
          tone="error"
          icon={<AlertTriangle size={24} />}
          title="Could not load the price history"
          description={error instanceof Error ? error.message : "The request did not come back. Check your connection and try again."}
        >
          <Button variant="outline" onClick={() => refetch()}>Try again</Button>
        </ConsoleListEmpty>
      );
    }

    if (!entries) {
      return (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <TableColumns />
            <tbody>
              {Array.from({ length: 8 }).map((_, i) => <RowSkeleton key={i} />)}
            </tbody>
          </table>
        </div>
      );
    }

    if (entries.length === 0) {
      return (
        <ConsoleListEmpty
          icon={<History size={24} />}
          title={hasFilters ? "No price changes match these filters" : "No price changes yet"}
          description={
            hasFilters
              ? "Widen the filters or clear them to see every recorded change."
              : "Every time a teacher changes the price of a product, it is recorded here. Recording began on 19 Nov 2026."
          }
        >
          {hasFilters && <Button variant="outline" onClick={clearFilters}>Clear filters</Button>}
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
                <th scope="col">Product</th>
                <th scope="col">Type</th>
                <th scope="col">Teacher</th>
                <th scope="col" className={styles.num}>Previous</th>
                <th scope="col" className={styles.num}>New</th>
                <th scope="col" className={styles.num}>Change</th>
                <th scope="col">Changed at</th>
                <th scope="col"><span className={styles.srOnly}>Action</span></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td title={entry.productTitle}>
                    <span className={styles.stack}>
                      <span className={`${styles.primaryLine} ${styles.truncate}`}>{entry.productTitle}</span>
                      <span className={styles.secondaryLine}>#{entry.productId}</span>
                    </span>
                  </td>
                  <td>{PRICE_HISTORY_TYPE_LABELS[entry.productType]}</td>
                  <td title={entry.teacherName ?? undefined} className={entry.teacherName ? undefined : styles.muted}>
                    {entry.teacherName ?? "Not recorded"}
                  </td>
                  <td className={`${styles.num} ${styles.muted}`}>{formatHistoryPrice(entry.previousPrice)}</td>
                  <td className={`${styles.num} ${styles.strong}`}>{formatHistoryPrice(entry.newPrice)}</td>
                  <td className={styles.num}>
                    <PriceDelta
                      previous={entry.previousPrice}
                      next={entry.newPrice}
                      previousList={entry.previousListPrice}
                      nextList={entry.newListPrice}
                    />
                  </td>
                  <td className={styles.date}>{renderChangedAt(entry.changedAt)}</td>
                  <td>{renderAction(entry)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={styles.cardsContainer}>
          {entries.map((entry) => (
            <article key={entry.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.stack}>
                  <span className={styles.primaryLine}>{entry.productTitle}</span>
                  <span className={styles.secondaryLine}>
                    {PRICE_HISTORY_TYPE_LABELS[entry.productType]} · {entry.teacherName ?? "Teacher not recorded"}
                  </span>
                </span>
                {renderAction(entry)}
              </div>
              <dl className={styles.cardStats}>
                <div className={styles.cardStat}>
                  <dt>Previous</dt>
                  <dd>{formatHistoryPrice(entry.previousPrice)}</dd>
                </div>
                <div className={styles.cardStat}>
                  <dt>New</dt>
                  <dd>{formatHistoryPrice(entry.newPrice)}</dd>
                </div>
                <div className={styles.cardStat}>
                  <dt>Change</dt>
                  <dd>
                    <PriceDelta
                      previous={entry.previousPrice}
                      next={entry.newPrice}
                      previousList={entry.previousListPrice}
                      nextList={entry.newListPrice}
                      layout="inline"
                    />
                  </dd>
                </div>
                <div className={styles.cardStat}>
                  <dt>Changed at</dt>
                  <dd>{renderChangedAt(entry.changedAt)}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </>
    );
  };

  const teacherOptions = (data?.teachers ?? []).map((t) => ({ value: String(t.id), label: t.name, count: t.count }));

  return (
    <>
      <Helmet>
        <title>Price history - Testkart Admin</title>
        <meta name="description" content="Audit log of every price change teachers make to their products." />
      </Helmet>
      <div className={styles.page}>
        <ConsolePageHeader title="Price history" />

        <ConsoleListToolbar
          tabs={tabs}
          value={typeTab}
          onValueChange={(value) => write({ type: value === "all" ? null : value })}
          tabsLabel="Product type"
          search={{
            value: search,
            onChange: setSearch,
            placeholder: "Search product or teacher",
            label: "Search price history by product or teacher name",
          }}
          aside={
            <div className={styles.filters}>
              <AdminFacetSelect
                label="Teacher"
                allLabel="All teachers"
                options={teacherOptions}
                selected={teacherId !== null ? [String(teacherId)] : []}
                onChange={(values) => write({ teacher: values.length ? values[values.length - 1] : null })}
                searchable
                className={styles.teacherSelect}
              />
              <Select value={movement || ANY} onValueChange={(v) => setMovement(v === ANY ? "" : (v as PriceMovement))}>
                <SelectTrigger className={`${consoleToolbarControlClass} ${styles.control}`} aria-label="Price change direction">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>All changes</SelectItem>
                  {PRICE_MOVEMENTS.map((m) => (
                    <SelectItem key={m} value={m}>{PRICE_MOVEMENT_LABELS[m]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <label className={styles.dateField}>
                <span>From</span>
                <Input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} aria-label="Changed on or after" />
              </label>
              <label className={styles.dateField}>
                <span>To</span>
                <Input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} aria-label="Changed on or before" />
              </label>
              <Select value={sort} onValueChange={(v) => setSort(v as "newest" | "oldest")}>
                <SelectTrigger className={`${consoleToolbarControlClass} ${styles.control}`} aria-label="Sort order">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest first</SelectItem>
                  <SelectItem value="oldest">Oldest first</SelectItem>
                </SelectContent>
              </Select>
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>Clear</Button>
              )}
            </div>
          }
        />

        <div className={styles.results} aria-live="polite">
          {data && entries && (
            <p className={styles.summary}>
              {data.total.toLocaleString("en-IN")} {data.total === 1 ? "change" : "changes"}
            </p>
          )}
          {renderContent()}
        </div>

        {entries && data && data.totalPages > 1 && (
          <ConsoleListPagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />
        )}

        <AdminPriceHistorySheet target={target} onOpenChange={(open) => { if (!open) setTarget(null); }} />
      </div>
    </>
  );
}