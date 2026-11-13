import React from "react";
import { Check } from "lucide-react";
import { SellDemoButton, SellStartLink } from "./SellLandingCta";
import { SellLandingHeroArt } from "./SellLandingHeroArt";
import styles from "./SellLandingHero.module.css";

const TRUST_POINTS = ["No setup fees", "Easy publishing", "Built for educators"];

export const SellLandingHero = () => (
  <section className={styles.hero} aria-labelledby="sell-hero-title">
    <div className={styles.inner}>
      <div className={styles.copy}>
        <span className={styles.eyebrow}>
          <svg className={styles.sparkle} viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z" />
          </svg>
          For educators &amp; creators
        </span>

        <h1 id="sell-hero-title" className={styles.title}>
          Your Knowledge Deserves to{" "}
          <span className={styles.mark}>
            Earn More.
            <svg
              className={styles.underline}
              viewBox="0 0 220 18"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path d="M3 13 C 40 4, 80 4, 112 10 S 180 16, 217 6" />
            </svg>
          </span>
        </h1>

        <p className={styles.lead}>
          Create, publish and sell mock tests, courses, study notes and digital
          learning resources. Reach students across India with Testkart.
        </p>

        <div className={styles.ctas}>
          <SellStartLink />
          <SellDemoButton />
        </div>

        <ul className={styles.trust}>
          {TRUST_POINTS.map((point) => (
            <li key={point}>
              <span className={styles.trustIcon} aria-hidden="true">
                <Check size={12} strokeWidth={3} />
              </span>
              {point}
            </li>
          ))}
        </ul>
      </div>

      <SellLandingHeroArt />
    </div>
  </section>
);
