import React, { useState } from "react";
import { Ban, Download, Ticket } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./Button";
import { Dialog } from "./Dialog";
import { ConsoleDialogBody, ConsoleDialogContent, ConsoleDialogFooter, ConsoleDialogHeader } from "./ConsoleDialog";
import { ConsoleConfirmDialog } from "./ConsoleConfirmDialog";
import { ConsoleListToolbar, consoleToolbarControlClass } from "./ConsoleListToolbar";
import { ConsoleListEmpty } from "./ConsoleListEmpty";
import { ConsoleListPagination } from "./ConsoleListPagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./Select";
import { Skeleton } from "./Skeleton";
import { SpinCouponBadge } from "./SpinWinBadges";
import { SpinCell, SpinWinDataTable, type SpinColumn } from "./SpinWinDataTable";
import { useSpinCoupon, useSpinCoupons, useVoidSpinCoupon } from "../helpers/useSpinWinAdmin";
import { adminFormat } from "../helpers/adminFormat";
import { parseErrorMessage } from "../helpers/parseErrorMessage";
import { discountLabel, SPIN_CATEGORY_LABELS, SPIN_COUPON_STATUS_LABELS, SPIN_COUPON_STATUSES, type SpinCategory, type SpinCouponStatus } from "../helpers/spinWinRules";
import { spinDate, spinDateTime } from "../helpers/spinWinFormat";
import { COUPON_SORTS } from "../endpoints/admin/spin-win/coupons_GET.schema";
import type { AdminSpinCouponRow } from "../endpoints/admin/spin-win/coupons_GET.schema";
import { downloadAdminSpinExport } from "../endpoints/admin/spin-win/export_GET.schema";
import styles from "./SpinWinCouponsPanel.module.css";

type Props = { campaignId?: number };

const SORT_LABELS: Record<(typeof COUPON_SORTS)[number], string> = {
  issued_desc: "Newest first",
  issued_asc: "Oldest first",
  expires_asc: "Expiring soonest",
  expires_desc: "Expiring latest",
};

const couponDiscount = (c: Pick<AdminSpinCouponRow, "discountType" | "discountValue" | "minOrderValue" | "maxDiscountAmount">) =>
  `${discountLabel(c.discountType, c.discountValue)}${c.minOrderValue > 0 ? `, min ${adminFormat.inr(c.minOrderValue)}` : ""}`;

export const SpinWinCouponsPanel: React.FC<Props> = ({ campaignId }) => {
  const [status, setStatus] = useState<"all" | SpinCouponStatus>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<(typeof COUPON_SORTS)[number]>("issued_desc");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);

  const query = useSpinCoupons({ campaignId, page, search: search || undefined, status: status === "all" ? undefined : status, sort });
  const data = query.data;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  const columns: SpinColumn<AdminSpinCouponRow>[] = [
    { key: "code", header: "Coupon", hideInCard: true, render: (c) => <SpinCell.Stack primary={<SpinCell.Code>{c.code}</SpinCell.Code>} secondary={c.rewardName} /> },
    {
      key: "student",
      header: "Student",
      width: "13rem",
      render: (c) => <SpinCell.Stack primary={c.studentName ?? `User #${c.userId}`} secondary={c.studentEmail ?? c.studentMobile ?? undefined} />,
    },
    { key: "discount", header: "Discount", width: "9rem", render: (c) => couponDiscount(c) },
    ...(campaignId ? [] : [{ key: "campaign", header: "Campaign", width: "10rem", render: (c: AdminSpinCouponRow) => c.campaignName }]),
    { key: "status", header: "Status", width: "7.5rem", hideInCard: true, render: (c) => <SpinCouponBadge status={c.status} /> },
    { key: "issued", header: "Issued on", width: "7rem", render: (c) => spinDate(c.issuedAt) },
    { key: "expires", header: "Expires on", width: "7rem", render: (c) => spinDate(c.expiresAt) },
  ];

  const exportCsv = async () => {
    setExporting(true);
    try {
      await downloadAdminSpinExport({ kind: "coupons", campaignId });
    } catch (error) {
      toast.error(parseErrorMessage(error));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className={styles.panel}>
      <ConsoleListToolbar
        tabs={[{ value: "all", label: "All" }, ...SPIN_COUPON_STATUSES.map((s) => ({ value: s, label: SPIN_COUPON_STATUS_LABELS[s] }))]}
        value={status}
        onValueChange={(value) => {
          setStatus(value as typeof status);
          setPage(1);
        }}
        tabsLabel="Coupon status"
        search={{
          value: search,
          onChange: (value) => {
            setSearch(value);
            setPage(1);
          },
          placeholder: "Code, student name or email",
          label: "Search coupons",
        }}
      >
        <Select value={sort} onValueChange={(value) => setSort(value as typeof sort)}>
          <SelectTrigger className={consoleToolbarControlClass} aria-label="Sort coupons">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COUPON_SORTS.map((s) => (
              <SelectItem key={s} value={s}>
                {SORT_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={exportCsv} disabled={exporting}>
          <Download size={16} /> {exporting ? "Exporting…" : "CSV"}
        </Button>
      </ConsoleListToolbar>

      {query.isError ? (
        <ConsoleListEmpty tone="error" icon={<Ticket size={20} />} title="Coupons could not be loaded" description={parseErrorMessage(query.error)}>
          <Button variant="outline" onClick={() => query.refetch()}>
            Try again
          </Button>
        </ConsoleListEmpty>
      ) : !data ? (
        <Skeleton style={{ height: "16rem", borderRadius: "var(--radius-md)" }} />
      ) : data.rows.length === 0 ? (
        <ConsoleListEmpty icon={<Ticket size={20} />} title="No coupons" description={search || status !== "all" ? "Nothing matches these filters." : "Coupons appear here once students claim rewards."} />
      ) : (
        <>
          <SpinWinDataTable
            rows={data.rows}
            columns={columns}
            rowKey={(c) => c.id}
            caption="Spin & Win coupons"
            busy={query.isFetching}
            cardTitle={(c) => <SpinCell.Stack primary={<SpinCell.Code>{c.code}</SpinCell.Code>} secondary={c.rewardName} />}
            cardAside={(c) => <SpinCouponBadge status={c.status} />}
            onOpen={(c) => setOpenId(c.id)}
            openLabel={(c) => `Open coupon ${c.code}`}
          />
          <div className={styles.footer}>
            <span className={styles.count}>{adminFormat.count(data.total)} coupons</span>
            {totalPages > 1 ? <ConsoleListPagination page={page} totalPages={totalPages} onPageChange={setPage} /> : null}
          </div>
        </>
      )}

      <SpinWinCouponDetail id={openId} onClose={() => setOpenId(null)} />
    </div>
  );
};

const SpinWinCouponDetail: React.FC<{ id: number | null; onClose: () => void }> = ({ id, onClose }) => {
  const { data, isError, error } = useSpinCoupon(id);
  const [voiding, setVoiding] = useState(false);
  const [reason, setReason] = useState("");
  const voidCoupon = useVoidSpinCoupon();
  const coupon = data?.coupon;
  const canVoid = coupon && (coupon.status === "active" || coupon.status === "expired") && data.usages.every((u) => !["completed", "refunded", "pending"].includes(u.orderStatus));

  return (
    <Dialog open={id !== null} onOpenChange={(open) => !open && onClose()}>
      <ConsoleDialogContent size="md">
        <ConsoleDialogHeader title={coupon ? coupon.code : "Coupon"} description={coupon ? `${coupon.campaignName} · ${coupon.rewardName}` : undefined}>
          {coupon ? <SpinCouponBadge status={coupon.status} /> : null}
        </ConsoleDialogHeader>
        <ConsoleDialogBody className={styles.detail}>
          {isError ? (
            <p className={styles.error}>{parseErrorMessage(error)}</p>
          ) : !coupon ? (
            <Skeleton style={{ height: "12rem" }} />
          ) : (
            <>
              <dl className={styles.facts}>
                <div>
                  <dt>Student</dt>
                  <dd>
                    {coupon.studentName ?? "Unnamed"} (#{coupon.userId})
                    <br />
                    <span className={styles.muted}>{coupon.studentEmail ?? coupon.studentMobile}</span>
                  </dd>
                </div>
                <div>
                  <dt>Discount</dt>
                  <dd>{discountLabel(coupon.discountType, coupon.discountValue)}</dd>
                </div>
                <div>
                  <dt>Minimum eligible order</dt>
                  <dd>{coupon.minOrderValue > 0 ? adminFormat.inr(coupon.minOrderValue) : "None"}</dd>
                </div>
                <div>
                  <dt>Maximum discount</dt>
                  <dd>
                    {coupon.maxDiscountAmount ? `${adminFormat.inr(coupon.maxDiscountAmount)}, and ` : ""}
                    {coupon.maxDiscountPercent}% of the eligible cart
                  </dd>
                </div>
                <div>
                  <dt>Applies to</dt>
                  <dd>{coupon.eligibleCategories.map((c) => SPIN_CATEGORY_LABELS[c as SpinCategory] ?? c).join(", ")}</dd>
                </div>
                <div>
                  <dt>Won</dt>
                  <dd>
                    {spinDateTime(coupon.spunAt)} as {coupon.spunAs === "guest" ? "a guest" : "a logged-in student"}
                  </dd>
                </div>
                <div>
                  <dt>Issued</dt>
                  <dd>{spinDateTime(coupon.issuedAt)}</dd>
                </div>
                <div>
                  <dt>Expires</dt>
                  <dd>{spinDateTime(coupon.expiresAt)}</dd>
                </div>
                {coupon.voidedAt ? (
                  <div className={styles.wide}>
                    <dt>Voided</dt>
                    <dd>
                      {spinDateTime(coupon.voidedAt)} by {coupon.voidedByName ?? "an admin"}: {coupon.voidedReason}
                    </dd>
                  </div>
                ) : null}
              </dl>

              <h3 className={styles.subhead}>Orders</h3>
              {data.usages.length === 0 ? (
                <p className={styles.muted}>Not used yet.</p>
              ) : (
                <ul className={styles.usages}>
                  {data.usages.map((u) => (
                    <li key={u.orderId}>
                      <span>
                        Order #{u.orderId} · {u.orderStatus}
                      </span>
                      <span className={styles.money}>
                        {adminFormat.inr(u.originalAmount)} - {adminFormat.inr(u.discountAmount)} = {adminFormat.inr(u.paidAmount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className={styles.note}>Issued coupons cannot be edited. Void one only to withdraw it.</p>
            </>
          )}
        </ConsoleDialogBody>
        <ConsoleDialogFooter>
          {canVoid ? (
            <Button variant="destructive" onClick={() => setVoiding(true)}>
              <Ban size={16} /> Void coupon
            </Button>
          ) : null}
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </ConsoleDialogFooter>
      </ConsoleDialogContent>

      <ConsoleConfirmDialog
        open={voiding}
        onOpenChange={(open) => {
          setVoiding(open);
          if (!open) setReason("");
        }}
        title="Void this coupon?"
        description="The student will no longer be able to use it. This cannot be undone."
        tone="destructive"
        icon={<Ban size={18} />}
        confirmLabel="Void coupon"
        pendingLabel="Voiding…"
        isPending={voidCoupon.isPending}
        note={{ label: "Reason", value: reason, onChange: setReason, required: true, placeholder: "e.g. duplicate accounts" }}
        onConfirm={() =>
          coupon &&
          voidCoupon.mutate(
            { id: coupon.id, reason },
            {
              onSuccess: () => {
                setVoiding(false);
                setReason("");
              },
            }
          )
        }
      />
    </Dialog>
  );
};