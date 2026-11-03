import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Gift } from "lucide-react";
import { useCreatorBonusOverview } from "../helpers/useCreatorBonus";
import { formatRupees } from "../helpers/teacherCampaignRules";
import styles from "./TeacherOverviewCreatorBonus.module.css";

/*
 * Dashboard band for the Creator Bonus: the offer, what is earned, and one
 * short status. The rules and claims live on the Creator Bonus page. Hidden
 * while no campaign runs or it is loading.
 */
export const TeacherOverviewCreatorBonus: React.FC = () => {
  const { data } = useCreatorBonusOverview();
  if (!data || !data.campaign) return null;

  const { slots, earned, items, examCampaigns } = data;
  const max = slots.mock_test.limit * slots.mock_test.amount + slots.course.limit * slots.course.amount;
  // Only items the teacher can still tick at submit, not ones already live or in review.
  const ready = items.filter((i) => i.state === "ready" && !i.live && !i.inReview).length;
  const waiting = slots.mock_test.used - slots.mock_test.credited + slots.course.used - slots.course.credited;
  const openExams = examCampaigns.filter((c) => c.slotsTaken < c.totalSlots).length;

  const status =
    ready > 0
      ? `${ready} ready to claim`
      : waiting > 0
        ? `${waiting} ${waiting === 1 ? "claim" : "claims"} in review`
        : openExams > 0
          ? `Exam Bonus open for ${openExams} ${openExams === 1 ? "exam" : "exams"}`
          : null;

  return (
    <section className={styles.wrap} aria-labelledby="overview-creator-bonus">
      <Link to="/teacher/creator-bonus" className={styles.band}>
        <span className={styles.blob} aria-hidden="true">
          <Gift size={22} />
        </span>
        <span className={styles.text}>
          <span id="overview-creator-bonus" className={styles.title}>
            {data.campaign.title}: {formatRupees(slots.mock_test.amount)} per test series or course
          </span>
          <span className={styles.line}>
            {formatRupees(earned)} of {formatRupees(max)} earned
            {status && <span className={styles.status}>{status}</span>}
          </span>
        </span>
        <ArrowRight className={styles.arrow} size={20} aria-hidden="true" />
      </Link>
    </section>
  );
};
