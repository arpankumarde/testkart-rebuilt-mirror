import React from "react";
import { ExternalLink } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "./Sheet";
import { Badge } from "./Badge";
import { PaymentFailureReason } from "./PaymentFailureReason";
import { OrderPlatformBadge } from "./OrderPlatformBadge";
import type { AdminOrderClient, AdminOrderRow } from "../endpoints/admin/orders/search_POST.schema";
import {
  ORDER_DEVICE_TYPE_LABELS,
  paymentMethodLabel,
  paymentModeLabel,
} from "../helpers/orderAttribution";
import {
  browserLabel,
  deviceLabel,
  formatDateTime,
  formatInr,
  ITEM_TYPE_LABELS,
  NOT_CAPTURED_LABEL,
  osLabel,
} from "../helpers/transactionDisplay";
import { ORDER_DISCOUNT_METHOD_LABELS } from "../helpers/orderDiscountMethod";
import styles from "./AdminTransactionDetailSheet.module.css";

const STATUS_VARIANTS = {
  completed: "success",
  pending: "warning",
  failed: "destructive",
  cancelled: "outline",
  refunded: "destructive",
} as const;

export type DetailRow = [label: string, value: React.ReactNode, options?: { mono?: boolean; muted?: boolean }];
type Row = DetailRow;

/** A titled block of label/value rows; shared with the subscription detail sheet. */
export const DetailSection: React.FC<{ title: string; rows: Row[] }> = ({ title, rows }) => (
  <section className={styles.section}>
    <h3 className={styles.sectionTitle}>{title}</h3>
    <dl className={styles.list}>
      {rows.map(([label, value, options]) => (
        <div key={label} className={styles.row}>
          <dt>{label}</dt>
          <dd className={`${options?.mono ? styles.mono : ""} ${options?.muted ? styles.mutedValue : ""}`}>{value}</dd>
        </div>
      ))}
    </dl>
  </section>
);
const Section = DetailSection;

export const detailSheetClasses = { sheet: styles.sheet, header: styles.header, headerTop: styles.headerTop, status: styles.status, body: styles.body, footer: styles.footer };

/**
 * Where a payment was made from. Shared by the order and subscription detail
 * sheets so both read the same way. inheritedFrom marks a renewal whose source
 * was copied from the payment that set the subscription up.
 */
export const ClientSourceSection: React.FC<{ client: AdminOrderClient | null; inheritedFrom?: number | null; capturedFrom?: string }> = ({
  client,
  inheritedFrom,
  capturedFrom = "orders placed",
}) => {
  const isApp = client?.source === "android_app" || client?.source === "ios_app";
  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>Device and source</h3>
      {client ? (
        <dl className={styles.list}>
          <div className={styles.row}>
            <dt>Platform</dt>
            <dd>
              <OrderPlatformBadge platform={client.platform} />
            </dd>
          </div>
          {[
            ...(inheritedFrom ? ([["Captured", `From transaction #${inheritedFrom}, the sign-up this renewal belongs to`, false]] as const) : []),
            ["Operating system", osLabel(client), !client.osName] as const,
            ["Device type", ORDER_DEVICE_TYPE_LABELS[client.deviceType], client.deviceType === "unknown"] as const,
            ["Device", deviceLabel(client), !client.deviceBrand && !client.deviceModel] as const,
            ...(isApp
              ? ([["App version", client.appVersion ?? "Not sent by this app build", !client.appVersion]] as const)
              : ([["Browser", browserLabel(client), !client.browserName]] as const)),
            ["Screen", client.screen ?? NOT_CAPTURED_LABEL, !client.screen] as const,
            ...(!isApp ? ([["Source", client.referrer ?? "Direct or not captured", !client.referrer]] as const) : []),
            ["IP address", client.ip ?? "Not recorded", !client.ip] as const,
          ].map(([label, value, muted]) => (
            <div key={label} className={styles.row}>
              <dt>{label}</dt>
              <dd className={muted ? styles.mutedValue : ""}>{value}</dd>
            </div>
          ))}
          <div className={`${styles.row} ${styles.rowWide}`}>
            <dt>User agent</dt>
            <dd className={client.userAgent ? styles.mono : styles.mutedValue}>{client.userAgent ?? "Not recorded"}</dd>
          </div>
        </dl>
      ) : (
        <p className={styles.mutedValue}>Not captured. Source and device are recorded for {capturedFrom} from 5 Nov 2026.</p>
      )}
    </section>
  );
};

const missing = (value: string | null | undefined, fallback = NOT_CAPTURED_LABEL): [React.ReactNode, { muted: boolean } | undefined] =>
  value ? [value, undefined] : [fallback, { muted: true }];

/** Original amount, the one discount method used (promo code or Tcoins, never both) and what was paid. */
const paymentBreakdownRows = (order: AdminOrderRow): Row[] => {
  const rows: Row[] = [
    ["Discount method", ORDER_DISCOUNT_METHOD_LABELS[order.discountMethod], { muted: order.discountMethod === "none" }],
    ["Original amount", formatInr(order.originalAmount)],
  ];
  if (order.discountMethod === "promo_code") {
    rows.push(
      [
        "Promo code",
        order.promoCode
          ? `${order.promoCode}${order.promoAutoApplied ? " (teacher offer, applied automatically)" : ""}`
          : "Not available",
        { muted: !order.promoCode },
      ],
      ["Promo discount", `-${formatInr(order.discountAmount)}`]
    );
  } else if (order.discountAmount > 0) {
    rows.push(["Discount", `-${formatInr(order.discountAmount)}`]);
  }
  if (order.tcoinsRedeemed > 0) {
    rows.push(
      ["Tcoins redeemed", `${order.tcoinsRedeemed.toLocaleString("en-IN")} Tcoins`],
      ["Tcoin value", `-${formatInr(order.tcoinsValue)}`]
    );
  }
  rows.push(["Final paid amount", formatInr(order.totalAmount)]);
  return rows;
};

interface AdminTransactionDetailSheetProps {
  order: AdminOrderRow | null;
  onOpenChange: (open: boolean) => void;
  /** The same row actions as the table (invoice, refund, reconcile, mark failed). */
  actions?: React.ReactNode;
}

export const AdminTransactionDetailSheet: React.FC<AdminTransactionDetailSheetProps> = ({ order, onOpenChange, actions }) => {
  const row = (label: string, value: string | null | undefined, fallback?: string, mono?: boolean): Row => {
    const [content, options] = missing(value, fallback);
    return [label, content, { ...options, mono: mono && !!value }];
  };

  return (
    <Sheet open={!!order} onOpenChange={onOpenChange}>
      <SheetContent side="right" className={styles.sheet}>
        {order && (
          <>
            <SheetHeader className={styles.header}>
              <div className={styles.headerTop}>
                <SheetTitle>Order #{order.id}</SheetTitle>
                <Badge variant={STATUS_VARIANTS[order.status]} className={styles.status}>
                  {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                </Badge>
              </div>
              <SheetDescription>
                {formatInr(order.totalAmount)} by {order.studentName}, {formatDateTime(order.createdAt)}
              </SheetDescription>
            </SheetHeader>

            <div className={styles.body}>
              <Section
                title="Transaction"
                rows={[
                  ["Order ID", `#${order.id}`],
                  row("Transaction ID", order.paymentTransactionId, "None", true),
                  ["Placed", formatDateTime(order.createdAt)],
                  [
                    "Payment completed",
                    order.paidAt ? formatDateTime(order.paidAt) : order.status === "completed" || order.status === "refunded" ? "Time not recorded" : "Not paid",
                    { muted: !order.paidAt },
                  ],
                  ["Gateway", order.paymentMethod === "payu" ? "PayU" : "No gateway"],
                  ["Payment method", paymentMethodLabel(order.paymentMethod), { muted: !order.paymentMethod }],
                  row(
                    "Payment mode",
                    paymentModeLabel(order.paymentMode),
                    order.paymentMethod === "payu" ? "Not recorded" : "Not applicable"
                  ),
                  row("Invoice number", order.invoiceNumber, "Not issued", true),
                  ...(order.status === "refunded"
                    ? ([
                        ["Refunded", formatDateTime(order.refundedAt)],
                        row("Refund reason", order.refundReason, "None given"),
                      ] as Row[])
                    : []),
                  ...(order.paymentFailure
                    ? ([["Failure reason", <PaymentFailureReason key="reason" failure={order.paymentFailure} variant="card" />]] as Row[])
                    : []),
                ]}
              />

              <Section title="Payment breakdown" rows={paymentBreakdownRows(order)} />

              <Section
                title="Student"
                rows={[
                  ["Name", order.isSponsored ? `${order.studentName} (sponsored by teacher)` : order.studentName],
                  row("Email", order.studentEmail, "Not on file"),
                  row("Mobile", order.studentPhone, "Not on file"),
                ]}
              />

              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>Product</h3>
                {order.purchasedItemDetails.length > 0 ? (
                  <ul className={styles.items}>
                    {order.purchasedItemDetails.map((item, index) => (
                      <li key={`${item.url}-${index}`}>
                        <a href={item.url} target="_blank" rel="noopener noreferrer" className={styles.itemLink}>
                          {item.title}
                          <ExternalLink aria-hidden="true" />
                        </a>
                        <span className={styles.itemType}>{ITEM_TYPE_LABELS[item.type] ?? item.type}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.mutedValue}>{order.purchasedItems || "No items recorded"}</p>
                )}
                <dl className={styles.list}>
                  <div className={styles.row}>
                    <dt>Teacher</dt>
                    <dd className={order.teacherName ? "" : styles.mutedValue}>{order.teacherName ?? "No teacher"}</dd>
                  </div>
                </dl>
              </section>

              <ClientSourceSection client={order.client} />
            </div>

            {actions && <SheetFooter className={styles.footer}>{actions}</SheetFooter>}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};