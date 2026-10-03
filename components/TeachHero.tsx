import { Link } from "react-router-dom";
import { TeachCtaButton } from "./TeachCtaButton";
import styles from "./TeachHero.module.css";

/** Generated studio portrait (a fictional teacher), 768x1024 on a warm off-white backdrop. */
const HERO_PHOTO = "/_cdn/static/23871ed3-cffd-49d7-b00a-47b5c2ea40c8.png";

/**
 * /teach hero: headline and CTA on the left, a large teacher portrait on the right.
 * The H1 reads as one sentence; "Teach on Testkart" keeps the big display size
 * and the rest of the sentence sits under it as a smaller line.
 */
export const TeachHero = () => (
  <section className={styles.hero} aria-labelledby="teach-hero-title">
    <div className={styles.inner}>
      <div className={styles.copy}>
        <h1 id="teach-hero-title" className={styles.title}>
          Teach on Testkart<span className={styles.srOnly}>: </span>
          <span className={styles.titleRest}>sell your mock tests, notes and courses online</span>
        </h1>
        <p className={styles.lead}>
          Share what you know with exam aspirants across India. Create mock tests, test series, notes and
          courses, set your own price and earn on every sale. Signing up is free.
        </p>
        <TeachCtaButton className={styles.cta} />
        <Link to="/demo" className={styles.watch}>
          Watch how it works
        </Link>
      </div>
      <div className={styles.media}>
        <img
          src={HERO_PHOTO}
          alt="A teacher presenting an online lesson on Testkart"
          width={768}
          height={1024}
          fetchPriority="high"
          decoding="async"
          className={styles.photo}
        />
      </div>
    </div>
  </section>
);
