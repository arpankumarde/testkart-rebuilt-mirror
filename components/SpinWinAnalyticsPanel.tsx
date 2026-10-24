import React, { useState } from "react";
import { Download, Info } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./Button";
import { Input } from "./Input";
import { Skeleton } from "./Skeleton";
import { ConsoleListEmpty } from "./ConsoleListEmpty";
import { SpinWinStatGrid, type SpinStatItem } from "./SpinWinStatGrid";
import {
  SpinChartGrid,
  SpinDailySpinsChart,
  SpinParticipationChart,
  SpinRedemptionChart,
  SpinRevenueDiscountChart,
  SpinRewardDistributionChart,
} from "./SpinWinCharts";
import { useSpinAnalytics } from "../helpers/useSpinWinAdmin";
import { adminFormat } from "../helpers/adminFormat";
import { parseErrorMessage } from "../helpers/parseErrorMessage";
import { SPIN_FUNDING_LABELS, SPIN_REWARD_TYPE_LABELS, type SpinRewardType } from "../helpers/spinWinRules";
import type { SpinFinance, SpinStats } from "../helpers/spinWinAnalytics";
import { downloadAdminSpinExport } from "../endpoints/admin/spin-win/export_GET.schema";
import styles from "./SpinWinAnalyticsPanel.module.css";

type Props = { campaignId?: number; view: "performance" | "finance" };

const rate = (part: number, whole: number) => (whole > 0 ? `${adminFormat.share(part, whole)}%` : "-");

export function performanceItems(stats: SpinStats): SpinStatItem[] {
  return [
    { label: "Total spins", value: adminFormat.count(stats.totalSpins), tone: "peach" },
    { label: "Unique participants", value: adminFormat.count(stats.uniqueParticipants), tone: "cream" },
    { label: "Logged-in spins", value: adminFormat.count(stats.userSpins), note: rate(stats.userSpins, stats.totalSpins), tone: "mint" },
    { label: "Guest spins", value: adminFormat.count(stats.guestSpins), note: rate(stats.guestSpins, stats.totalSpins), tone: "lavender" },
    { label: "Coupons generated", value: adminFormat.count(stats.couponsGenerated), tone: "powder" },
    { label: "Rewards claimed", value: adminFormat.count(stats.claimed), note: `${rate(stats.claimed, stats.totalSpins)} claim rate`, tone: "sage" },
    { label: "Coupons redeemed", value: adminFormat.count(stats.couponsRedeemed), note: `${rate(stats.couponsRedeemed, stats.couponsGenerated)} of issued`, tone: "mint" },
    { label: "Unclaimed rewards", value: adminFormat.count(stats.unclaimed), note: stats.forfeited ? `${stats.forfeited} forfeited` : undefined, tone: "butter" },
    { label: "Orders", value: adminFormat.count(stats.orders), tone: "cream" },
    { label: "Revenue", value: adminFormat.inr(stats.revenue), tone: "peach" },
    { label: "Discount given", value: adminFormat.inr(stats.discount), tone: "lavender" },
    { label: "First-time buyers", value: adminFormat.count(stats.firstTimeBuyers), note: stats.repeatBuyers ? `${stats.repeatBuyers} bought again` : undefined, tone: "powder" },
  ];
}

export const FinanceTable: React.FC<{ finance: SpinFinance; stats: SpinStats; funding: string | null }> = ({ finance, stats, funding }) => {
  const rows: { label: string; current: number; proposed: number; strong?: boolean }[] = [
    { label: "Original order value", current: finance.originalValue, proposed: finance.originalValue },
    { label: "Student discount", current: finance.discount, proposed: finance.discount },
    { label: "Student paid", current: finance.studentPaid, proposed: finance.studentPaid },
    { label: "Testkart commission", current: finance.commissionOnPaid, proposed: finance.commissionOnOriginal },
    { label: "Teacher payouts", current: finance.teacherPayoutCurrent, proposed: finance.teacherPayoutProposed },
    { label: "Testkart margin after discount", current: finance.marginCurrent, proposed: finance.marginProposed, strong: true },
  ];
  return (
    <section className={styles.financeCard} aria-label="Discount funding">
      <div className={styles.financeHead}>
        <h2 className={styles.cardTitle}>Discount funding</h2>
        <span className={styles.subtitle}>
          {adminFormat.count(stats.orders)} orders · avg discount {stats.orders ? adminFormat.inr(finance.discount / stats.orders) : "-"}
        </span>
      </div>
      <div className={styles.financeNote} role="note">
        <Info size={16} aria-hidden="true" />
        <span>
          <strong>Current</strong> is how settlement works today: the discount comes off the sale before the platform fee, so teacher and Testkart
          share it. <strong>Proposed</strong> is the PRD model (commission on the original value, Testkart absorbs the discount). It needs finance
          approval and is not applied to payouts.
          {funding ? ` This campaign reports on: ${SPIN_FUNDING_LABELS[funding] ?? funding}.` : ""}
        </span>
      </div>
      <table className={styles.financeTable}>
        <thead>
          <tr>
            <th scope="col">Particulars</th>
            <th scope="col" className={funding === "current_split" ? styles.selected : undefined}>
              Current
            </th>
            <th scope="col" className={funding === "platform_funded" ? styles.selected : undefined}>
              Proposed
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className={row.strong ? styles.strong : undefined}>
              <th scope="row">{row.label}</th>
              <td>{adminFormat.inr(row.current)}</td>
              <td>{adminFormat.inr(row.proposed)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
};

export const SpinWinAnalyticsPanel: React.FC<Props> = ({ campaignId, view }) => {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [exporting, setExporting] = useState(false);
  const query = useSpinAnalytics({ campaignId, from: from || undefined, to: to || undefined });
  const data = query.data;

  const exportCsv = async (kind: "spins" | "coupons" | "redemptions") => {
    setExporting(true);
    try {
      await downloadAdminSpinExport({ kind, campaignId, from: from || data?.range.startDay, to: to || data?.range.endDay });
    } catch (error) {
      toast.error(parseErrorMessage(error));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className={styles.panel}>
      <div className={styles.controls}>
        <label className={styles.dateField}>
          <span>From</span>
          <Input type="date" value={from || data?.range.startDay || ""} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className={styles.dateField}>
          <span>To</span>
          <Input type="date" value={to || data?.range.endDay || ""} onChange={(e) => setTo(e.target.value)} />
        </label>
        {from || to ? (
          <Button
            variant="ghost"
            onClick={() => {
              setFrom("");
              setTo("");
            }}
          >
            Reset dates
          </Button>
        ) : null}
        <span className={styles.spacer} />
        <Button variant="outline" onClick={() => exportCsv(view === "finance" ? "redemptions" : "spins")} disabled={exporting}>
          <Download size={16} /> {view === "finance" ? "Redemptions CSV" : "Spins CSV"}
        </Button>
      </div>

      {query.isError ? (
        <ConsoleListEmpty tone="error" title="Analytics could not be loaded" description={parseErrorMessage(query.error)}>
          <Button variant="outline" onClick={() => query.refetch()}>
            Try again
          </Button>
        </ConsoleListEmpty>
      ) : !data ? (
        <Skeleton style={{ height: "24rem", borderRadius: "var(--radius-md)" }} />
      ) : view === "performance" ? (
        <>
          <SpinWinStatGrid items={performanceItems(data.stats)} isLoading={query.isFetching && !data} label="Campaign performance" />
          <SpinChartGrid>
            <SpinDailySpinsChart daily={data.daily} />
            <SpinRewardDistributionChart rewards={data.rewards} />
            <SpinParticipationChart stats={data.stats} />
            <SpinRedemptionChart rewards={data.rewards} />
            <SpinRevenueDiscountChart daily={data.daily} />
          </SpinChartGrid>
        </>
      ) : (
        <>
          <FinanceTable finance={data.finance} stats={data.stats} funding={data.discountFunding} />
          <section className={styles.financeCard} aria-label="Discount cost by reward">
            <h2 className={styles.cardTitle}>Discount cost by reward</h2>
            <table className={styles.financeTable}>
              <thead>
                <tr>
                  <th scope="col">Reward</th>
                  <th scope="col">Redeemed</th>
                  <th scope="col">Revenue</th>
                  <th scope="col">Discount</th>
                </tr>
              </thead>
              <tbody>
                {data.rewards.map((r) => (
                  <tr key={r.rewardId}>
                    <th scope="row">
                      <span className={styles.dot} style={{ background: r.segmentColor }} aria-hidden="true" /> {r.name}
                    </th>
                    <td>{adminFormat.count(r.redeemed)}</td>
                    <td>{adminFormat.inr(r.revenue)}</td>
                    <td>{adminFormat.inr(r.discount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                {data.typeCosts.map((t) => (
                  <tr key={t.rewardType}>
                    <th scope="row">All {SPIN_REWARD_TYPE_LABELS[t.rewardType as SpinRewardType]?.toLowerCase() ?? t.rewardType}</th>
                    <td>{adminFormat.count(t.redemptions)}</td>
                    <td />
                    <td>{adminFormat.inr(t.discount)}</td>
                  </tr>
                ))}
              </tfoot>
            </table>
          </section>
        </>
      )}
    </div>
  );
};