import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  useAdminMandatesQuery,
  useRetryMandateChargeMutation,
  useRevokeMandateMutation,
  useOverrideMandateMutation,
  useUpdateMandateAdminMutation,
} from "../helpers/useAdminMandates";
import { MandateAdminRow, MandateStats } from "../endpoints/admin/mandates/list_GET.schema";
import { Button } from "./Button";
import { Badge } from "./Badge";
import { Input } from "./Input";
import { Textarea } from "./Textarea";
import { Skeleton } from "./Skeleton";
import { Dialog } from "./Dialog";
import { ConsoleDialogContent, ConsoleDialogHeader, ConsoleDialogBody, ConsoleDialogFooter } from "./ConsoleDialog";
import { ConsoleConfirmDialog } from "./ConsoleConfirmDialog";
import { Form, FormItem, FormLabel, FormControl, FormMessage, FormDescription, useForm } from "./Form";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectItem } from "./Select";
import { Tooltip, TooltipContent, TooltipTrigger } from "./Tooltip";
import {
  Activity,
  IndianRupee,
  CalendarClock,
  PieChart,
  Zap,
  Ban,
  Percent,
  StickyNote,
  AlertCircle,
  FileText,
} from "lucide-react";
import { z } from "zod";
import tableStyles from "./AdminSubscriptionPlansManager.module.css";
import styles from "./AdminMandatesManager.module.css";

const MANDATE_STATUS_LABELS: Record<string, string> = {
  active: "Active",
  paused: "Paused by payer",
  cancel_pending: "Revoke pending",
  cancelled: "Cancelled",
  unknown: "Unknown",
};

const statusBadgeVariant = (status: string): "success" | "warning" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case "active":
      return "success";
    case "paused":
    case "cancel_pending":
      return "warning";
    case "cancelled":
      return "secondary";
    default:
      return "outline";
  }
};

const formatMoney = (value: number) =>
  `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

const formatDate = (date: Date | string | null): string => {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
};

type DueFilter = "all" | "overdue" | "due7" | "due30" | "failed";

export const AdminMandatesManager: React.FC = () => {
  const { data, isFetching, isError, error, refetch } = useAdminMandatesQuery();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("__all");
  const [modeFilter, setModeFilter] = useState<string>("__all");
  const [dueFilter, setDueFilter] = useState<DueFilter>("all");

  const [retryTarget, setRetryTarget] = useState<MandateAdminRow | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<MandateAdminRow | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [overrideTarget, setOverrideTarget] = useState<MandateAdminRow | null>(null);
  const [adminTarget, setAdminTarget] = useState<MandateAdminRow | null>(null);

  const retryMutation = useRetryMandateChargeMutation();
  const revokeMutation = useRevokeMandateMutation();

  const mandates = data?.mandates ?? [];
  const stats = data?.stats;

  const now = Date.now();
  const in7 = now + 7 * 24 * 60 * 60 * 1000;
  const in30 = now + 30 * 24 * 60 * 60 * 1000;

  const filtered = useMemo(() => {
    return mandates.filter((m) => {
      if (statusFilter !== "__all" && (m.mandateStatus ?? "unknown") !== statusFilter) return false;
      if (modeFilter !== "__all" && (m.mandatePaymentMode ?? "unknown") !== modeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!m.teacherName.toLowerCase().includes(q) && !(m.teacherEmail ?? "").toLowerCase().includes(q)) return false;
      }
      const isLive = m.mandateStatus === "active" && m.status === "active" && m.autoRenew;
      if (dueFilter === "failed") return isLive && m.lastTransactionStatus === "failed";
      if (dueFilter !== "all") {
        if (!isLive || !m.nextChargeDate) return false;
        const nc = new Date(m.nextChargeDate).getTime();
        if (dueFilter === "overdue") return nc < now;
        if (dueFilter === "due7") return nc >= now && nc <= in7;
        if (dueFilter === "due30") return nc >= now && nc <= in30;
      }
      return true;
    });
  }, [mandates, statusFilter, modeFilter, search, dueFilter, now, in7, in30]);

  const confirmRetry = () => {
    if (!retryTarget) return;
    retryMutation.mutate(
      { subscriptionId: retryTarget.subscriptionId },
      {
        onSuccess: (res) => {
          toast.success(res.chargeStatus === "captured" ? "Charged successfully." : res.message);
          setRetryTarget(null);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to charge mandate."),
      }
    );
  };

  const confirmRevoke = () => {
    if (!revokeTarget) return;
    revokeMutation.mutate(
      { subscriptionId: revokeTarget.subscriptionId, reason: revokeReason.trim() || undefined },
      {
        onSuccess: () => {
          toast.success("Mandate revoked. Auto-renew is now off.");
          setRevokeTarget(null);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to revoke mandate."),
      }
    );
  };

  if (isError) {
    return (
      <div className={tableStyles.panel}>
        <p className={tableStyles.emptyState}>
          {error instanceof Error ? error.message : "Could not load mandates."}{" "}
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Try again
          </Button>
        </p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <MandateInsights stats={stats} isFetching={isFetching} />

      <div className={tableStyles.panel}>
        <div className={tableStyles.panelHeader}>
          <div>
            <h2 className={tableStyles.panelTitle}>Mandates</h2>
            <p className={tableStyles.panelDescription}>
              Every UPI Autopay / standing instruction mandate, any status or payment mode.
            </p>
          </div>
        </div>

        <div className={styles.toolbar}>
          <Input
            placeholder="Search by teacher name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.toolbarControl}
            style={{ minWidth: "16rem" }}
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className={styles.toolbarControl}>
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All statuses</SelectItem>
              {Object.entries(MANDATE_STATUS_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={modeFilter} onValueChange={setModeFilter}>
            <SelectTrigger className={styles.toolbarControl}>
              <SelectValue placeholder="All payment modes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All payment modes</SelectItem>
              <SelectItem value="UPI">UPI Autopay</SelectItem>
              <SelectItem value="unknown">Unknown / legacy</SelectItem>
            </SelectContent>
          </Select>
          <Select value={dueFilter} onValueChange={(v) => setDueFilter(v as DueFilter)}>
            <SelectTrigger className={styles.toolbarControl}>
              <SelectValue placeholder="Any charge timing" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any charge timing</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="due7">Due in 7 days</SelectItem>
              <SelectItem value="due30">Due in 30 days</SelectItem>
              <SelectItem value="failed">Last charge failed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className={tableStyles.results}>
          {isFetching && !data ? (
            <div className={tableStyles.tableContainer} style={{ display: "block" }}>
              <table className={tableStyles.table}>
                <tbody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td>
                        <Skeleton style={{ height: "0.875rem", width: "70%" }} />
                      </td>
                      <td>
                        <Skeleton style={{ height: "0.875rem", width: "50%" }} />
                      </td>
                      <td>
                        <Skeleton style={{ height: "1.125rem", width: "3.5rem" }} />
                      </td>
                      <td>
                        <Skeleton style={{ height: "0.875rem", width: "60%" }} />
                      </td>
                      <td>
                        <Skeleton style={{ height: "1.5rem", width: "5rem", marginLeft: "auto" }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : filtered.length === 0 ? (
            <p className={tableStyles.emptyState}>
              {mandates.length === 0 ? "No mandates have been created yet." : "Nothing matches these filters."}
            </p>
          ) : (
            <>
              <div className={tableStyles.tableContainer} style={{ display: "block" }}>
                <table className={tableStyles.table}>
                  <thead>
                    <tr>
                      <th>Teacher</th>
                      <th>Plan</th>
                      <th>Mandate</th>
                      <th>Next charge</th>
                      <th>Last charge</th>
                      <th>
                        <span className={tableStyles.srOnly}>Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((m) => (
                      <MandateRow
                        key={m.subscriptionId}
                        mandate={m}
                        onRetry={() => setRetryTarget(m)}
                        onRevoke={() => {
                          setRevokeReason("");
                          setRevokeTarget(m);
                        }}
                        onOverride={() => setOverrideTarget(m)}
                        onAdmin={() => setAdminTarget(m)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      <ConsoleConfirmDialog
        open={!!retryTarget}
        onOpenChange={(open) => !open && setRetryTarget(null)}
        title="Charge this mandate now?"
        description={
          retryTarget
            ? `Immediately attempts to charge ₹${retryTarget.effectiveChargeAmount.toLocaleString("en-IN")} to ${retryTarget.teacherName}'s mandate via PayU, bypassing the usual pre-debit-notice wait.`
            : undefined
        }
        confirmLabel="Charge now"
        pendingLabel="Charging..."
        isPending={retryMutation.isPending}
        onConfirm={confirmRetry}
      />

      <ConsoleConfirmDialog
        open={!!revokeTarget}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
        tone="destructive"
        icon={<Ban size={20} />}
        title="Revoke this mandate?"
        description={
          revokeTarget
            ? `Stops autopay for ${revokeTarget.teacherName} immediately. PayU has no merchant-side "pause" - this revokes the mandate outright and turns auto-renew off. Their plan still runs until it ends; it just won't renew.`
            : undefined
        }
        confirmLabel="Revoke mandate"
        pendingLabel="Revoking..."
        isPending={revokeMutation.isPending}
        onConfirm={confirmRevoke}
        note={{
          label: "Reason",
          value: revokeReason,
          onChange: setRevokeReason,
          placeholder: "Teacher requested cancellation",
          hint: "Optional. Saved to this subscription's admin note.",
        }}
      />

      <OverrideDialog
        open={!!overrideTarget}
        onOpenChange={(open) => !open && setOverrideTarget(null)}
        mandate={overrideTarget}
      />

      <AdminFieldsDialog open={!!adminTarget} onOpenChange={(open) => !open && setAdminTarget(null)} mandate={adminTarget} />
    </div>
  );
};

const MandateRow: React.FC<{
  mandate: MandateAdminRow;
  onRetry: () => void;
  onRevoke: () => void;
  onOverride: () => void;
  onAdmin: () => void;
}> = ({ mandate: m, onRetry, onRevoke, onOverride, onAdmin }) => {
  const isDiscounted = m.effectiveChargeAmount < m.planPrice;
  const canRetry = m.mandateStatus === "active" && m.status === "active";
  const canRevoke = m.mandateStatus === "active" || m.mandateStatus === "paused";

  return (
    <tr>
      <td>
        <div className={tableStyles.stack}>
          <span className={tableStyles.primaryLine}>
            <span className={tableStyles.truncate} title={m.teacherName}>
              {m.teacherName}
            </span>
          </span>
          <span className={tableStyles.secondaryLine} title={m.teacherEmail ?? undefined}>
            {m.teacherEmail ?? "Not given"}
          </span>
        </div>
      </td>
      <td>
        <div className={tableStyles.stack}>
          <span className={tableStyles.valueLine} title={m.planName}>
            {m.planName}
          </span>
          {m.promoDuration && (
            <span className={tableStyles.secondaryLine}>
              {m.promoCode ? `${m.promoCode} · ` : "Manual override · "}
              {m.promoDuration === "every_month" ? "every renewal" : "first cycle only"}
            </span>
          )}
        </div>
      </td>
      <td>
        <div className={tableStyles.stack}>
          <Badge variant={statusBadgeVariant(m.mandateStatus ?? "unknown")} className={tableStyles.flag}>
            {MANDATE_STATUS_LABELS[m.mandateStatus ?? "unknown"] ?? m.mandateStatus}
          </Badge>
          <span className={tableStyles.secondaryLine}>
            {m.mandatePaymentMode ?? "Unknown mode"} · ceiling {formatMoney(m.mandateMaxAmount ?? 0)}
          </span>
        </div>
      </td>
      <td>
        <div className={styles.amountCell}>
          <span className={tableStyles.valueLine}>{formatDate(m.nextChargeDate)}</span>
          <span className={tableStyles.valueLine}>
            {formatMoney(m.effectiveChargeAmount)}
            {isDiscounted && <span className={styles.strikethrough}> {formatMoney(m.planPrice)}</span>}
          </span>
        </div>
      </td>
      <td>
        <div className={tableStyles.stack}>
          <span className={tableStyles.valueLine}>{formatDate(m.lastChargeDate)}</span>
          {m.lastTransactionStatus && (
            <Badge
              variant={m.lastTransactionStatus === "completed" ? "success" : m.lastTransactionStatus === "failed" ? "destructive" : "secondary"}
              className={tableStyles.flag}
            >
              {m.lastTransactionStatus}
            </Badge>
          )}
          {m.lastTransactionStatus === "failed" && m.lastTransactionError && (
            <span className={styles.lastChargeError} title={m.lastTransactionError}>
              {m.lastTransactionError}
            </span>
          )}
        </div>
      </td>
      <td>
        <div className={tableStyles.rowActions}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-md"
                className={tableStyles.iconButton}
                aria-label={`Charge ${m.teacherName}'s mandate now`}
                onClick={onRetry}
                disabled={!canRetry}
              >
                <Zap />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{canRetry ? "Charge now" : "Mandate or subscription is not active"}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-md"
                className={`${tableStyles.iconButton} ${styles.iconButtonDanger}`}
                aria-label={`Revoke ${m.teacherName}'s mandate`}
                onClick={onRevoke}
                disabled={!canRevoke}
              >
                <Ban />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{canRevoke ? "Revoke mandate" : "Already cancelled"}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-md"
                className={tableStyles.iconButton}
                aria-label={`Edit discount override for ${m.teacherName}`}
                onClick={onOverride}
              >
                <Percent />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Per-cycle charge override</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-md"
                className={tableStyles.iconButton}
                aria-label={`Edit admin note for ${m.teacherName}`}
                onClick={onAdmin}
              >
                <StickyNote />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Admin note &amp; fee override</TooltipContent>
          </Tooltip>
        </div>
      </td>
    </tr>
  );
};

const MandateInsights: React.FC<{ stats: MandateStats | undefined; isFetching: boolean }> = ({
  stats,
  isFetching,
}) => {
  if (isFetching && !stats) {
    return (
      <div className={styles.insightsGrid}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={styles.insightCard}>
            <Skeleton style={{ width: "60%", height: "0.875rem" }} />
            <Skeleton style={{ width: "100%", height: "3rem" }} />
          </div>
        ))}
      </div>
    );
  }
  if (!stats) return null;

  return (
    <div className={styles.insightsGrid}>
      <div className={styles.insightCard}>
        <h3 className={styles.insightTitle}>
          <Activity size={16} /> Mandate health
        </h3>
        <div className={styles.bigStat}>
          <span className={styles.bigStatValue}>{stats.totalMandates}</span>
          <span className={styles.bigStatLabel}>total mandates ever created</span>
        </div>
        <div className={styles.chipRow}>
          {Object.entries(stats.statusCounts).map(([status, count]) => (
            <span
              key={status}
              className={`${styles.chip} ${status === "active" ? styles.chipSuccess : status === "cancelled" ? "" : styles.chipWarning}`}
            >
              {MANDATE_STATUS_LABELS[status] ?? status} <span className={styles.chipValue}>{count}</span>
            </span>
          ))}
        </div>
        <div className={styles.chipRow}>
          {Object.entries(stats.paymentModeCounts).map(([mode, count]) => (
            <span key={mode} className={styles.chip}>
              {mode} <span className={styles.chipValue}>{count}</span>
            </span>
          ))}
          {Object.entries(stats.frequencyCounts).map(([freq, count]) => (
            <span key={freq} className={styles.chip}>
              {freq} <span className={styles.chipValue}>{count}</span>
            </span>
          ))}
        </div>
      </div>

      <div className={styles.insightCard}>
        <h3 className={styles.insightTitle}>
          <CalendarClock size={16} /> Upcoming &amp; failed charges
        </h3>
        <div className={styles.chipRow}>
          <span className={`${styles.chip} ${stats.overdue > 0 ? styles.chipDanger : ""}`}>
            Overdue <span className={styles.chipValue}>{stats.overdue}</span>
          </span>
          <span className={styles.chip}>
            Due in 7d <span className={styles.chipValue}>{stats.dueWithin7Days}</span>
          </span>
          <span className={styles.chip}>
            Due in 30d <span className={styles.chipValue}>{stats.dueWithin30Days}</span>
          </span>
          <span className={`${styles.chip} ${stats.failedLastCharge > 0 ? styles.chipDanger : ""}`}>
            Failed last try <span className={styles.chipValue}>{stats.failedLastCharge}</span>
          </span>
        </div>
        {stats.failedLastCharge > 0 && (
          <p className={tableStyles.secondaryLine} style={{ display: "flex", alignItems: "center", gap: "var(--spacing-1)" }}>
            <AlertCircle size={14} /> {stats.failedLastCharge} mandate{stats.failedLastCharge !== 1 ? "s" : ""} need attention
          </p>
        )}
      </div>

      <div className={styles.insightCard}>
        <h3 className={styles.insightTitle}>
          <IndianRupee size={16} /> Promo code impact
        </h3>
        <div className={styles.bigStat}>
          <span className={styles.bigStatValue}>{formatMoney(stats.totalDiscountGivenAllTime)}</span>
          <span className={styles.bigStatLabel}>total discount given on autopay charges, all time</span>
        </div>
        <div className={styles.chipRow}>
          <span className={styles.chip}>
            On every renewal <span className={styles.chipValue}>{stats.activeEveryMonthPromoCount}</span>
          </span>
          <span className={styles.chip}>
            First cycle only <span className={styles.chipValue}>{stats.activeFirstMonthPromoCount}</span>
          </span>
        </div>
        <p className={tableStyles.secondaryLine}>
          {formatMoney(stats.monthlyRecurringDiscountTotal)} discounted off every month, ongoing, across active subscriptions.
        </p>
      </div>

      <div className={styles.insightCard}>
        <h3 className={styles.insightTitle}>
          <PieChart size={16} /> Plan-level MRR (mandates)
        </h3>
        {stats.planBreakdown.length === 0 ? (
          <p className={tableStyles.secondaryLine}>No live mandates yet.</p>
        ) : (
          <div className={styles.planRows}>
            {stats.planBreakdown.map((p) => (
              <div key={p.planId} className={styles.planRow}>
                <span className={styles.planRowName}>
                  {p.planName}
                  <span className={styles.planRowSub}>× {p.activeMandateCount}</span>
                </span>
                <span className={styles.planRowValue}>{formatMoney(p.estimatedMrr)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const overrideSchema = z.object({
  enabled: z.boolean(),
  duration: z.enum(["first_month", "every_month"]),
  amount: z.string().refine((v) => v === "" || (!isNaN(parseFloat(v)) && parseFloat(v) > 0), "Must be a positive number"),
});

const OverrideDialog: React.FC<{ open: boolean; onOpenChange: (open: boolean) => void; mandate: MandateAdminRow | null }> = ({
  open,
  onOpenChange,
  mandate,
}) => {
  const overrideMutation = useOverrideMandateMutation();
  const defaultValues = {
    enabled: !!mandate?.promoDuration,
    duration: (mandate?.promoDuration as "first_month" | "every_month") || "every_month",
    amount: mandate?.promoDiscountAmount != null ? String(mandate.promoDiscountAmount) : "",
  };
  const form = useForm<typeof overrideSchema>({ schema: overrideSchema, defaultValues });

  React.useEffect(() => {
    if (open) form.setValues(defaultValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mandate?.subscriptionId]);

  if (!mandate) return null;

  const handleSubmit = (data: typeof defaultValues) => {
    overrideMutation.mutate(
      {
        subscriptionId: mandate.subscriptionId,
        promoDuration: data.enabled ? data.duration : null,
        promoDiscountAmount: data.enabled && data.amount ? parseFloat(data.amount) : null,
      },
      {
        onSuccess: () => {
          toast.success("Charge override saved.");
          onOpenChange(false);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save the override."),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ConsoleDialogContent size="md">
        <ConsoleDialogHeader
          title={`Per-cycle charge override for ${mandate.teacherName}`}
          description={`Plan price is ${formatMoney(mandate.planPrice)}. Set a discount that applies to the next charge, or every renewal, independent of any promo code.`}
        />
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <ConsoleDialogBody>
              <div className={styles.dialogFields}>
                <FormItem name="enabled">
                  <div className={tableStyles.switchRow}>
                    <div>
                      <FormLabel>Apply a discount override</FormLabel>
                      <FormDescription>Turn off to charge the full plan price again.</FormDescription>
                    </div>
                    <FormControl>
                      <input
                        type="checkbox"
                        checked={form.values.enabled}
                        onChange={(e) => form.setValues((prev) => ({ ...prev, enabled: e.target.checked }))}
                      />
                    </FormControl>
                  </div>
                </FormItem>

                {form.values.enabled && (
                  <>
                    <FormItem name="duration">
                      <FormLabel>Applies to</FormLabel>
                      <FormControl>
                        <Select
                          value={form.values.duration}
                          onValueChange={(val: any) => form.setValues((prev) => ({ ...prev, duration: val }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectItem value="first_month">Next charge only</SelectItem>
                              <SelectItem value="every_month">Every renewal going forward</SelectItem>
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>

                    <FormItem name="amount">
                      <FormLabel>Discount amount (₹ off)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="e.g. 1599.80"
                          value={form.values.amount}
                          onChange={(e) => form.setValues((prev) => ({ ...prev, amount: e.target.value }))}
                        />
                      </FormControl>
                      <FormDescription>
                        Charges within the existing mandate ceiling of {formatMoney(mandate.mandateMaxAmount ?? mandate.planPrice)} - no new mandate needed as long as the discounted amount stays under it.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  </>
                )}
              </div>
            </ConsoleDialogBody>
            <ConsoleDialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={overrideMutation.isPending}>
                {overrideMutation.isPending ? "Saving..." : "Save override"}
              </Button>
            </ConsoleDialogFooter>
          </form>
        </Form>
      </ConsoleDialogContent>
    </Dialog>
  );
};

const adminFieldsSchema = z.object({
  adminNote: z.string(),
  platformFeeOverride: z.string().refine((v) => v === "" || (!isNaN(parseFloat(v)) && parseFloat(v) >= 0 && parseFloat(v) <= 100), "0-100"),
});

const AdminFieldsDialog: React.FC<{ open: boolean; onOpenChange: (open: boolean) => void; mandate: MandateAdminRow | null }> = ({
  open,
  onOpenChange,
  mandate,
}) => {
  const updateMutation = useUpdateMandateAdminMutation();
  const defaultValues = {
    adminNote: mandate?.adminNote ?? "",
    platformFeeOverride: mandate?.platformFeeOverride != null ? String(mandate.platformFeeOverride) : "",
  };
  const form = useForm<typeof adminFieldsSchema>({ schema: adminFieldsSchema, defaultValues });

  React.useEffect(() => {
    if (open) form.setValues(defaultValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mandate?.subscriptionId]);

  if (!mandate) return null;

  const handleSubmit = (data: typeof defaultValues) => {
    updateMutation.mutate(
      {
        subscriptionId: mandate.subscriptionId,
        adminNote: data.adminNote.trim() === "" ? null : data.adminNote,
        platformFeeOverride: data.platformFeeOverride === "" ? null : parseFloat(data.platformFeeOverride),
      },
      {
        onSuccess: () => {
          toast.success("Saved.");
          onOpenChange(false);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save."),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ConsoleDialogContent size="md">
        <ConsoleDialogHeader title={`Admin note & fee — ${mandate.teacherName}`} description="Internal only; the teacher never sees either of these." />
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <ConsoleDialogBody>
              <div className={styles.dialogFields}>
                <FormItem name="adminNote">
                  <FormLabel>Admin note</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      value={form.values.adminNote}
                      onChange={(e) => form.setValues((prev) => ({ ...prev, adminNote: e.target.value }))}
                      placeholder="Context for the team"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
                <FormItem name="platformFeeOverride">
                  <FormLabel>Platform fee override (%, optional)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      placeholder="Use the plan's default fee"
                      value={form.values.platformFeeOverride}
                      onChange={(e) => form.setValues((prev) => ({ ...prev, platformFeeOverride: e.target.value }))}
                    />
                  </FormControl>
                  <FormDescription>Leave blank to fall back to the plan's own platform fee.</FormDescription>
                  <FormMessage />
                </FormItem>
              </div>
            </ConsoleDialogBody>
            <ConsoleDialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </ConsoleDialogFooter>
          </form>
        </Form>
      </ConsoleDialogContent>
    </Dialog>
  );
};
