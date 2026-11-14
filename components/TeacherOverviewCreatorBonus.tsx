import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Gift, Trophy } from "lucide-react";
import { useCreatorBonusOverview } from "../helpers/useCreatorBonus";
import { bonusWord, contentListText, creatorBonusLeft, formatRupees } from "../helpers/teacherCampaignRules";
import styles from "./TeacherOverviewCreatorBonus.module.css";

/*
 * Dashboard band for the Creator Bonus: what is still on offer, what is earned,
 * and one short status. Once every slot is claimed it turns into a completed
 * note instead of an offer. The rules and claims live on the Creator Bonus
 * page. Hidden while no campaign runs or it is loading.
 */
export const TeacherOverviewCreatorBonus: React.FC = () => {
  const { data } = useCreatorBonusOverview();
  if (!data || !data.campaign) return null;

  const { slots, earned, items, examCampaigns } = data;
  const { left, total, done } = creatorBonusLeft(slots);
  const max = slots.mock_test.limit * slots.mock_test.amount + slots.course.limit * slots.course.amount;
  // Bonuses credited under an earlier, higher cap can exceed today's maximum.
  const meterMax = Math.max(max, earned);
  // Only items the teacher can still tick at submit, not ones already live or in review.
  const ready = items.filter((i) => i.state === "ready" && !i.live && !i.inReview).length;
  const waiting = slots.mock_test.used - slots.mock_test.credited + slots.course.used - slots.course.credited;
  const openExams = examCampaigns.filter((c) => c.slotsTaken < c.totalSlots).length;
  const untouched = total === slots.mock_test.limit + slots.course.limit;

  const title = done
    ? "All Creator Bonuses claimed"
    : untouched
      ? `${data.campaign.title}: ${formatRupees(slots.mock_test.amount)} each for ${contentListText(left)}`
      : `${data.campaign.title}: ${contentListText(left)} ${bonusWord(total)} left`;

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
          {done ? <Trophy size={22} /> : <Gift size={22} />}
        </span>
        <span className={styles.text}>
          <span id="overview-creator-bonus" className={styles.title}>
            {title}
          </span>
          <span className={styles.line}>
            {done && waiting === 0
              ? `${formatRupees(earned)} earned. Congratulations!`
              : `${formatRupees(earned)} of ${formatRupees(meterMax)} earned`}
            {status && <span className={styles.status}>{status}</span>}
          </span>
        </span>
        <ArrowRight className={styles.arrow} size={20} aria-hidden="true" />
      </Link>
    </section>
  );
};
