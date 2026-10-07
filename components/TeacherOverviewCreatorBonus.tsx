import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Gift } from "lucide-react";
import { useCreatorBonusOverview } from "../helpers/useCreatorBonus";
import { formatRupees } from "../helpers/teacherCampaignRules";
import styles from "./TeacherOverviewCreatorBonus.module.css";

/*
 * Dashboard band for the Creator Bonus: what is earned, what is ready to claim,
 * and the way to the full page. Hidden while no campaign runs or it is loading.
 */
export const TeacherOverviewCreatorBonus: React.FC = () => {
  const { data } = useCreatorBonusOverview();
  if (!data || !data.campaign) return null;

  const { slots, earned, items, campaign } = data;
  const max = slots.mock_test.limit * slots.mock_test.amount + slots.course.limit * slots.course.amount;
  const ready = items.filter((i) => i.state === "ready").length;
  const waiting = slots.mock_test.used - slots.mock_test.credited + slots.course.used - slots.course.credited;
  const req = campaign.requirements;

  const line =
    ready > 0
      ? `${ready} of your ${ready === 1 ? "items is" : "items are"} ready to claim. Tick the bonus when you submit for review.`
      : waiting > 0
        ? `${waiting} ${waiting === 1 ? "claim is" : "claims are"} with our team. ${formatRupees(max - earned)} is still open to earn.`
        : earned > 0
          ? `${formatRupees(max - earned)} is still open to earn.`
          : `Build a test series with ${req.minTests}+ tests and ${req.minQuestions}+ questions, or a course with ${req.minVideos}+ uploaded videos of ${req.minMinutesPerVideo}+ minutes (${req.minVideoMinutes}+ in all).`;

  return (
    <section className={styles.wrap} aria-labelledby="overview-creator-bonus">
      <div className={styles.band}>
        <span className={styles.blob} aria-hidden="true">
          <Gift size={22} />
        </span>
        <div className={styles.text}>
          <h2 id="overview-creator-bonus" className={styles.title}>
            {campaign.title}: {formatRupees(slots.mock_test.amount)} for every great test series and course
          </h2>
          <p className={styles.line}>{line}</p>
        </div>
        <div className={styles.earned}>
          <span className={styles.earnedValue}>{formatRupees(earned)}</span>
          <span className={styles.earnedOf}>of {formatRupees(max)} earned</span>
        </div>
        <Link to="/teacher/creator-bonus" className={styles.cta}>
          {ready > 0 ? "See what to claim" : "Open Creator Bonus"}
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
};