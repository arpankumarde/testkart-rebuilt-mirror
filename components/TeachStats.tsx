import styles from "./TeachStats.module.css";

/*
 * Counted from the live database on 6 Oct 2026 and rounded down: teacher
 * accounts (10,802), mock tests not deleted (5,331), test questions (131,562),
 * exams (1,695) and published study notes (4,967). Update by hand as they grow.
 */
const STATS = [
  { value: "10K+", label: "Educators" },
  { value: "5K+", label: "Mock tests created" },
  { value: "1.3L+", label: "Practice questions" },
  { value: "1,600+", label: "Exams covered" },
  { value: "4,900+", label: "Study notes" },
];

/** /teach: full-width peach band of platform numbers. */
export const TeachStats = () => (
  <section className={styles.band} aria-label="Testkart in numbers">
    <dl className={styles.list}>
      {STATS.map((stat) => (
        <div key={stat.label} className={styles.stat}>
          <dt className={styles.label}>{stat.label}</dt>
          <dd className={styles.value}>{stat.value}</dd>
        </div>
      ))}
    </dl>
  </section>
);