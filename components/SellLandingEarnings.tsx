import React from "react";
import { Check, Landmark, Receipt } from "lucide-react";
import { DEFAULT_TEACHER_PLATFORM_FEE } from "../helpers/teacherPlatformFeeDefault";
import { SellLandingHeading } from "./SellLandingHeading";
import styles from "./SellLandingEarnings.module.css";

const EXAMPLE_PRICE = 500;
const FREE_FEE = DEFAULT_TEACHER_PLATFORM_FEE;
const FREE_SHARE = 100 - FREE_FEE;
const exampleShare = (EXAMPLE_PRICE * FREE_SHARE) / 100;
const exampleFee = EXAMPLE_PRICE - exampleShare;

/*
 * Paid plan fees as set in subscription_plans on 19-11-2026 (Starter 25%,
 * Individual 23%, Business 18%). Update here if the plans change.
 */
const PLAN_SHARES = [
  { plan: "Free", share: FREE_SHARE, tone: styles.peach },
  { plan: "Starter", share: 75, tone: styles.lavender },
  { plan: "Individual", share: 77, tone: styles.blue },
  { plan: "Business", share: 82, tone: styles.mint },
];

const POINTS = [
  "No listing or setup fees. The platform fee applies only when you sell.",
  "Your share is credited to your balance after every sale. Live test sales count once the test ends.",
  "Withdraw any amount from ₹100 to your verified bank account.",
];

const rupees = (value: number) => `₹${value.toLocaleString("en-IN")}`;

export const SellLandingEarnings = () => (
  <section className={styles.section} aria-labelledby="sell-earnings-title">
    <div className={styles.container}>
      <div className={styles.copy}>
        <SellLandingHeading
          id="sell-earnings-title"
          align="start"
          eyebrow="Revenue share"
          title="Clear Earnings, No Surprises."
          lead={`Joining is free. On the Free plan, Testkart keeps a ${FREE_FEE}% platform fee on each sale and the other ${FREE_SHARE}% is yours. Paid plans lower the fee to as little as 18%.`}
          className={styles.heading}
        />

        <ul className={styles.points}>
          {POINTS.map((point) => (
            <li key={point}>
              <span className={styles.pointIcon} aria-hidden="true">
                <Check size={14} strokeWidth={3} />
              </span>
              {point}
            </li>
          ))}
        </ul>
      </div>

      <div className={styles.visual}>
        <div className={styles.receipt}>
          <div className={styles.receiptHead}>
            <span className={styles.receiptIcon} aria-hidden="true">
              <Receipt size={18} />
            </span>
            <div>
              <p className={styles.receiptTitle}>Example sale on the Free plan</p>
              <p className={styles.receiptSub}>A test series priced at {rupees(EXAMPLE_PRICE)}</p>
            </div>
          </div>

          <div
            className={styles.split}
            role="img"
            aria-label={`${FREE_SHARE}% to you, ${FREE_FEE}% platform fee`}
          >
            <span className={styles.splitYou} style={{ flexBasis: `${FREE_SHARE}%` }}>
              {FREE_SHARE}%
            </span>
            <span className={styles.splitFee} style={{ flexBasis: `${FREE_FEE}%` }}>
              {FREE_FEE}%
            </span>
          </div>

          <dl className={styles.lines}>
            <div>
              <dt>Sale price</dt>
              <dd>{rupees(EXAMPLE_PRICE)}</dd>
            </div>
            <div>
              <dt>
                <span className={`${styles.swatch} ${styles.swatchFee}`} aria-hidden="true" />
                Platform fee ({FREE_FEE}%)
              </dt>
              <dd>- {rupees(exampleFee)}</dd>
            </div>
            <div className={styles.total}>
              <dt>
                <span className={`${styles.swatch} ${styles.swatchYou}`} aria-hidden="true" />
                You keep
              </dt>
              <dd>{rupees(exampleShare)}</dd>
            </div>
          </dl>

          <p className={styles.payout}>
            <Landmark size={15} aria-hidden="true" />
            Withdraw to your bank from ₹100
          </p>
        </div>

        <div className={styles.plans}>
          <p className={styles.plansTitle}>Your share by plan</p>
          <ul className={styles.planList}>
            {PLAN_SHARES.map(({ plan, share, tone }) => (
              <li key={plan} className={`${styles.plan} ${tone}`}>
                <span className={styles.planShare}>{share}%</span>
                <span className={styles.planName}>{plan}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  </section>
);
