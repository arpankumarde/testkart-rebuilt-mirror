import { TeachCtaButton } from "./TeachCtaButton";
import styles from "./TeachFinalCTA.module.css";

/** /teach closing band: centred headline, one line of copy and a wide CTA. */
export const TeachFinalCTA = () => (
  <section className={styles.section} aria-labelledby="teach-final-cta-title">
    <div className={styles.inner}>
      <h2 id="teach-final-cta-title" className={styles.title}>
        Become a Testkart instructor today
      </h2>
      <p className={styles.text}>
        Share your knowledge with learners and help build better learning experiences.
      </p>
      <TeachCtaButton className={styles.cta} />
    </div>
  </section>
);