import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, RefreshCw, ShoppingBag, TrendingDown, TrendingUp, Users, Wallet } from "lucide-react";
import {
  TeacherOverviewRangeValues,
  type OutputType,
  type TeacherOverviewRange,
} from "../endpoints/teacher/dashboard/overview_GET.schema";
import { adminFormat } from "../helpers/adminFormat";
import styles from "./TeacherOverviewMoneyPanel.module.css";

type Props = {
  data: OutputType;
  range: TeacherOverviewRange;
  onRangeChange: (range: TeacherOverviewRange) => void;
  onRefresh: () => void;
  refreshing: boolean;
};

const RANGE_SHORT: Record<TeacherOverviewRange, string> = { "7d": "7D", "30d": "30D", "90d": "90D" };
const RANGE_LONG: Record<TeacherOverviewRange, string> = { "7d": "7 days", "30d": "30 days", "90d": "90 days" };

/**
 * The stage panel for teachers who earn, on the light console surface: a
 * mint block with this period's money and its change against the period
 * before, three stat tiles beside it, and the period switch and refresh in
 * the panel they control. Balance and withdrawals stay on the Earnings page.
 */
export const TeacherOverviewMoneyPanel = ({ data, range, onRangeChange, onRefresh, refreshing }: Props) => {
  const { kpis, totals, days } = data;
  const diff = kpis.earnings.current - kpis.earnings.previous;

  const stats = [
    { key: "sales", label: `Sales in ${days} days`, value: adminFormat.count(kpis.sales.current), icon: ShoppingBag, tone: "lavender" },
    { key: "students", label: "Students", value: adminFormat.count(totals.students), icon: Users, tone: "blue" },
    { key: "lifetime", label: "Earned all time", value: adminFormat.inr(totals.lifetimeEarnings), icon: Wallet, tone: "butter" },
  ] as const;

  return (
    <section className={styles.panel} aria-labelledby="teacher-money-headline">
      <div className={styles.head}>
        <h2 className={styles.heading}>Earnings overview</h2>
        <div className={styles.tools}>
          <div className={styles.period} role="group" aria-label="Period">
            {TeacherOverviewRangeValues.map((value) => (
              <button
                key={value}
                type="button"
                className={styles.periodOption}
                aria-pressed={range === value}
                aria-label={`Last ${RANGE_LONG[value]}`}
                onClick={() => onRangeChange(value)}
              >
                {RANGE_SHORT[value]}
              </button>
            ))}
          </div>
          <button type="button" className={styles.refresh} onClick={onRefresh} disabled={refreshing} aria-label="Refresh">
            <RefreshCw size={15} className={refreshing ? styles.spin : undefined} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.hero}>
          <p id="teacher-money-headline" className={styles.label}>
            Earned in {days} days
          </p>
          <p className={styles.amount}>{adminFormat.inr(kpis.earnings.current)}</p>
          <p className={styles.compare}>
            {diff !== 0 ? (
              <span className={styles.change} data-dir={diff > 0 ? "up" : "down"}>
                {diff > 0 ? <TrendingUp size={14} aria-hidden="true" /> : <TrendingDown size={14} aria-hidden="true" />}
                {diff > 0 ? "Up" : "Down"} {adminFormat.inr(Math.abs(diff))}
              </span>
            ) : (
              <span className={styles.change} data-dir="flat">
                No change
              </span>
            )}
            <span className={styles.compareText}>vs previous {days} days</span>
          </p>
          <Link to="/teacher/earnings" className={styles.link}>
            View earnings
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>

        <dl className={styles.stats}>
          {stats.map(({ key, label, value, icon: Icon, tone }) => (
            <div key={key} className={styles.stat}>
              <span className={styles.statIcon} data-tone={tone} aria-hidden="true">
                <Icon size={17} />
              </span>
              <dt className={styles.statLabel}>{label}</dt>
              <dd className={styles.statValue}>{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
};
