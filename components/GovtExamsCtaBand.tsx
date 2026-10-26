import React from "react";
import { ArrowRight } from "lucide-react";
import { GEC_CTA } from "../helpers/govtExamsCalendarData";
import styles from "./GovtExamsCtaBand.module.css";

/**
 * The one mid-page CTA: a quiet sage band, copy on the left and a charcoal button on the
 * right. The button does not navigate yet: the target exam hub is still to be chosen.
 */
export const GovtExamsCtaBand: React.FC = () => (
  <section className={styles.band} aria-labelledby="gec-cta-title">
    <div className={styles.content}>
      <span className={styles.label}>Test series</span>
      <p id="gec-cta-title" className={styles.title}>
        {GEC_CTA.title}
      </p>
      <p className={styles.text}>{GEC_CTA.text}</p>
    </div>
    <button type="button" className={styles.button}>
      {GEC_CTA.button}
      <ArrowRight size={18} aria-hidden="true" className={styles.arrow} />
    </button>
  </section>
);
