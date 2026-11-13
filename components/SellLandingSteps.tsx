import React from "react";
import { PenLine, Rocket, Wallet } from "lucide-react";
import { SellLandingHeading } from "./SellLandingHeading";
import styles from "./SellLandingSteps.module.css";

const STEPS = [
  {
    number: "01",
    icon: PenLine,
    tone: styles.lavender,
    title: "Create your product",
    text: "Build a mock test, set up a course or upload your notes from the teacher dashboard.",
  },
  {
    number: "02",
    icon: Rocket,
    tone: styles.peach,
    title: "Publish it on Testkart",
    text: "Set your price and submit it. Our team reviews it, and once approved it goes live in the store.",
  },
  {
    number: "03",
    icon: Wallet,
    tone: styles.mint,
    title: "Reach students and earn",
    text: "Students find and buy it on Testkart. Your share lands in your balance, ready to withdraw.",
  },
];

export const SellLandingSteps = () => (
  <section className={styles.section} aria-labelledby="sell-steps-title">
    <div className={styles.container}>
      <SellLandingHeading
        id="sell-steps-title"
        eyebrow="How it works"
        title="From Creating to Earning, Made Simple."
      />

      <ol className={styles.steps}>
        {STEPS.map(({ number, icon: Icon, tone, title, text }) => (
          <li key={number} className={styles.step}>
            <div className={styles.marker}>
              <span className={`${styles.iconTile} ${tone}`} aria-hidden="true">
                <Icon size={26} />
              </span>
              <span className={styles.number}>{number}</span>
            </div>
            <h3 className={styles.title}>{title}</h3>
            <p className={styles.text}>{text}</p>
          </li>
        ))}
      </ol>
    </div>
  </section>
);
