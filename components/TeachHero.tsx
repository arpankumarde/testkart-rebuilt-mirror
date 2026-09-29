import { TeachCtaButton } from "./TeachCtaButton";
import styles from "./TeachHero.module.css";

/** Generated studio portrait (a fictional teacher), 768x1024 on a warm off-white backdrop. */
const HERO_PHOTO = "/_cdn/static/23871ed3-cffd-49d7-b00a-47b5c2ea40c8.png";

/** /teach hero: headline and CTA on the left, a large teacher portrait on the right. */
export const TeachHero = () => (
  <section className={styles.hero} aria-labelledby="teach-hero-title">
    <div className={styles.inner}>
      <div className={styles.copy}>
        <h1 id="teach-hero-title" className={styles.title}>
          Teach on Testkart
        </h1>
        <p className={styles.lead}>
          Share your knowledge, help students learn, and build your teaching journey with Testkart.
        </p>
        <TeachCtaButton className={styles.cta} />
      </div>
      <div className={styles.media}>
        <img
          src={HERO_PHOTO}
          alt=""
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