import React from "react";
import { AlertTriangle, History } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "./Sheet";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";
import { DetailSection, detailSheetClasses, type DetailRow } from "./AdminTransactionDetailSheet";
import { PriceDelta, PriceMovementFlag } from "./AdminPriceChange";
import { useAdminProductPriceHistoryQuery } from "../helpers/useAdminPriceHistory";
import {
  formatChangedAt,
  formatChangedAtExact,
  formatHistoryPrice,
  formatPercent,
  formatPriceDelta,
  priceChangePercent,
  PRICE_CHANGE_SOURCE_LABELS,
  PRICE_HISTORY_TYPE_LABELS,
  type PriceHistoryProductType,
} from "../helpers/productPriceHistory";
import type { PriceHistoryEntry } from "../endpoints/admin/price-history/list_GET.schema";
import styles from "./AdminPriceHistorySheet.module.css";

export type PriceHistoryTarget = {
  productType: PriceHistoryProductType;
  productId: string;
  /* The change the admin clicked in the log; without it the sheet opens on the product's timeline. */
  entry?: PriceHistoryEntry;
};

interface AdminPriceHistorySheetProps {
  target: PriceHistoryTarget | null;
  onOpenChange: (open: boolean) => void;
}

const listPriceText = (previous: number | null, next: number | null): string | null => {
  if (previous === null && next === null) return null;
  if (previous === next) return `${formatHistoryPrice(next)} (unchanged)`;
  return `${formatHistoryPrice(previous)} to ${formatHistoryPrice(next)}`;
};

const changeRows = (entry: PriceHistoryEntry): DetailRow[] => {
  const percent = formatPercent(priceChangePercent(entry.previousPrice, entry.newPrice));
  const list = listPriceText(entry.previousListPrice, entry.newListPrice);
  return [
    ["Product ID", `#${entry.productId}`],
    ["Product type", PRICE_HISTORY_TYPE_LABELS[entry.productType]],
    [
      "Teacher",
      entry.teacherId !== null ? `${entry.teacherName ?? "Unknown"} (#${entry.teacherId})` : "Not recorded",
      { muted: entry.teacherId === null },
    ],
    ["Previous price", formatHistoryPrice(entry.previousPrice)],
    ["New price", formatHistoryPrice(entry.newPrice)],
    [
      "Difference",
      <span key="diff" className={styles.inlineValue}>
        {formatPriceDelta(entry.previousPrice, entry.newPrice)}
        <PriceMovementFlag previous={entry.previousPrice} next={entry.newPrice} />
      </span>,
    ],
    ["Percentage change", percent ?? (entry.previousPrice === 0 ? "Not applicable from free" : "0%"), { muted: !percent }],
    ...(list ? ([["List price", list]] as DetailRow[]) : []),
    ["Changed at", formatChangedAtExact(entry.changedAt)],
    ["Changed by", entry.changedByName ?? "Not recorded", { muted: !entry.changedByName }],
    ["Change source", PRICE_CHANGE_SOURCE_LABELS[entry.changeSource]],
  ];
};

const statusLabel = (status: string | null): string =>
  status ? status.charAt(0).toUpperCase() + status.slice(1) : "Unknown";

export const AdminPriceHistorySheet: React.FC<AdminPriceHistorySheetProps> = ({ target, onOpenChange }) => {
  const query = useAdminProductPriceHistoryQuery(
    target ? { productType: target.productType, productId: target.productId } : null
  );
  const data = query.data;
  const entry = target?.entry;
  const title = entry?.productTitle ?? data?.product.title ?? (target ? `Product #${target.productId}` : "");

  const renderTimeline = () => {
    if (query.isError) {
      return (
        <div className={styles.state} role="alert">
          <AlertTriangle size={18} aria-hidden="true" />
          <p>{query.error instanceof Error ? query.error.message : "Could not load the price history."}</p>
          <Button variant="outline" size="sm" onClick={() => query.refetch()}>
            Try again
          </Button>
        </div>
      );
    }
    if (!data) {
      return (
        <div className={styles.skeletons}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} style={{ height: "1.75rem", width: "100%" }} />
          ))}
        </div>
      );
    }
    if (data.entries.length === 0) {
      return (
        <div className={styles.state}>
          <History size={18} aria-hidden="true" />
          <p>No price changes recorded for this product. Changes are recorded from 19 Nov 2026 onwards.</p>
        </div>
      );
    }
    return (
      <table className={styles.timeline}>
        <colgroup>
          <col className={styles.colDate} />
          <col className={styles.colMoney} />
          <col className={styles.colMoney} />
          <col />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col" className={styles.num}>Previous</th>
            <th scope="col" className={styles.num}>New</th>
            <th scope="col">Changed by</th>
          </tr>
        </thead>
        <tbody>
          {data.entries.map((row) => {
            const selected = row.id === entry?.id;
            return (
              <tr key={row.id} className={selected ? styles.selected : undefined} aria-current={selected ? "true" : undefined}>
                <td className={styles.date} title={formatChangedAtExact(row.changedAt)}>
                  {formatChangedAt(row.changedAt)}
                </td>
                <td className={styles.num}>{formatHistoryPrice(row.previousPrice)}</td>
                <td className={styles.num}>
                  <span className={styles.newCell}>
                    {formatHistoryPrice(row.newPrice)}
                    <PriceDelta
                      previous={row.previousPrice}
                      next={row.newPrice}
                      previousList={row.previousListPrice}
                      nextList={row.newListPrice}
                    />
                  </span>
                </td>
                <td className={styles.actor} title={row.changedByName ?? undefined}>
                  <span className={styles.truncate}>{row.changedByName ?? "Not recorded"}</span>
                  <span className={styles.source}>{PRICE_CHANGE_SOURCE_LABELS[row.changeSource]}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  };

  const product = data?.product;

  return (
    <Sheet open={!!target} onOpenChange={onOpenChange}>
      <SheetContent side="right" className={detailSheetClasses.sheet}>
        {target && (
          <>
            <SheetHeader className={detailSheetClasses.header}>
              <div className={detailSheetClasses.headerTop}>
                <SheetTitle className={styles.title}>{title}</SheetTitle>
              </div>
              <SheetDescription asChild>
                <div className={styles.badges}>
                  <Badge variant="outline" className={detailSheetClasses.status}>
                    {PRICE_HISTORY_TYPE_LABELS[target.productType]}
                  </Badge>
                  {product && (
                    <Badge variant={product.exists ? "outline" : "destructive"} className={detailSheetClasses.status}>
                      {product.exists ? statusLabel(product.status) : "Deleted"}
                    </Badge>
                  )}
                </div>
              </SheetDescription>
            </SheetHeader>

            <div className={`${detailSheetClasses.body} ${styles.body}`}>
              {entry && <DetailSection title="This change" rows={changeRows(entry)} />}

              {product && (
                <DetailSection
                  title="Product now"
                  rows={[
                    ...(entry ? [] : ([["Product ID", `#${target.productId}`]] as DetailRow[])),
                    ...(entry
                      ? []
                      : ([
                          [
                            "Teacher",
                            product.teacherId !== null ? `${product.teacherName ?? "Unknown"} (#${product.teacherId})` : "Not recorded",
                            { muted: product.teacherId === null },
                          ],
                        ] as DetailRow[])),
                    product.exists
                      ? ["Current price", formatHistoryPrice(product.currentPrice)]
                      : ["Current price", "Product deleted; its history is kept", { muted: true }],
                    ...(product.exists && product.currentListPrice !== null && product.currentListPrice !== product.currentPrice
                      ? ([["List price", formatHistoryPrice(product.currentListPrice)]] as DetailRow[])
                      : []),
                    ...(entry && product.title && product.title !== entry.productTitle
                      ? ([["Current title", product.title]] as DetailRow[])
                      : []),
                  ]}
                />
              )}

              <section className={styles.section} aria-labelledby="price-timeline-heading">
                <h3 id="price-timeline-heading" className={styles.sectionTitle}>
                  Price timeline
                  {data && data.entries.length > 0 && <span className={styles.count}>{data.entries.length}</span>}
                </h3>
                {renderTimeline()}
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};