import React from "react";
import { SellStartLink } from "./SellLandingCta";
import styles from "./SellLandingFinalCta.module.css";

export const SellLandingFinalCta = () => (
  <section className={styles.section} aria-labelledby="sell-final-title">
    <div className={styles.panel}>
      <span className={styles.accent} aria-hidden="true" />
      <h2 id="sell-final-title" className={styles.title}>
        Ready to Turn Your Knowledge into Opportunity?
      </h2>
      <p className={styles.text}>
        Join Testkart and start sharing your educational products with students.
      </p>
      <SellStartLink />
      <p className={styles.note}>Free to join. No setup fees.</p>
    </div>
  </section>
);
