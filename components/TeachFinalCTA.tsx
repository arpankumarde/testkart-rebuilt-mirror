import { Link } from "react-router-dom";
import { TeachCtaButton } from "./TeachCtaButton";
import styles from "./TeachFinalCTA.module.css";

/** /teach closing band: centred headline, one line of copy, a wide CTA and a demo link. */
export const TeachFinalCTA = () => (
  <section className={styles.section} aria-labelledby="teach-final-cta-title">
    <div className={styles.inner}>
      <h2 id="teach-final-cta-title" className={styles.title}>
        Earn from what you already teach
      </h2>
      <p className={styles.text}>
        Publish your mock tests, notes and courses on Testkart, set your own price and earn on every sale. Free to start.
      </p>
      <TeachCtaButton className={styles.cta} />
      <Link to="/demo" className={styles.watch}>
        Watch how it works
      </Link>
    </div>
  </section>
);
