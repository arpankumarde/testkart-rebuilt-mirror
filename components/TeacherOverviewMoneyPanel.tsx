import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import type { OutputType } from "../endpoints/teacher/dashboard/overview_GET.schema";
import { adminFormat } from "../helpers/adminFormat";
import styles from "./TeacherOverviewMoneyPanel.module.css";

type Props = { data: OutputType };

const changeLine = (current: number, previous: number) => {
  const diff = current - previous;
  if (diff === 0) return null;
  return `${diff > 0 ? "Up" : "Down"} ${adminFormat.inr(Math.abs(diff))}`;
};

/**
 * The stage panel for teachers who earn: this period's money and three
 * numbers. Balance and withdrawals stay on the Earnings page.
 */
export const TeacherOverviewMoneyPanel = ({ data }: Props) => {
  const { kpis, totals, days } = data;
  const change = changeLine(kpis.earnings.current, kpis.earnings.previous);

  return (
    <section className={styles.panel} aria-labelledby="teacher-money-headline">
      <div className={styles.top}>
        <div>
          <p id="teacher-money-headline" className={styles.label}>
            Earned in {days} days
          </p>
          <p className={styles.amount}>
            {adminFormat.inr(kpis.earnings.current)}
            {change && <span className={styles.change}>{change}</span>}
          </p>
        </div>
        <Link to="/teacher/earnings" className={styles.link}>
          Earnings
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
      <dl className={styles.stats}>
        <div>
          <dt>Sales</dt>
          <dd>{adminFormat.count(kpis.sales.current)}</dd>
        </div>
        <div>
          <dt>Students</dt>
          <dd>{adminFormat.count(totals.students)}</dd>
        </div>
        <div>
          <dt>All time</dt>
          <dd>{adminFormat.inr(totals.lifetimeEarnings)}</dd>
        </div>
      </dl>
    </section>
  );
};
