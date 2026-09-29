import styles from "./TeachingReasons.module.css";

const REASONS = [
  {
    title: "Teach your way",
    body: "Create courses and tests your way, with complete control over what you teach.",
    image: "/_cdn/static/c2c3cb38-0611-49df-83b9-77a06ae18700.png",
  },
  {
    title: "Inspire learners",
    body: "Share your knowledge, help students build new skills, and make learning accessible.",
    image: "/_cdn/static/ff7837ce-9ca2-4445-a5f2-e59487ef705b.png",
  },
  {
    title: "Get rewarded",
    body: "Grow your audience, build your reputation, and earn from your educational content.",
    image: "/_cdn/static/907a7c08-4325-4faf-97c6-a834cc54783e.png",
  },
];

/** /teach: three illustrated reasons to teach, centred in columns. */
export const TeachingReasons = () => (
  <section className={styles.section} aria-labelledby="teach-reasons-title">
    <h2 id="teach-reasons-title" className={styles.title}>
      So many reasons to teach
    </h2>
    <ul className={styles.grid}>
      {REASONS.map((reason) => (
        <li key={reason.title} className={styles.item}>
          <img
            src={reason.image}
            alt=""
            width={1024}
            height={1024}
            loading="lazy"
            decoding="async"
            className={styles.art}
          />
          <h3 className={styles.itemTitle}>{reason.title}</h3>
          <p className={styles.itemBody}>{reason.body}</p>
        </li>
      ))}
    </ul>
  </section>
);