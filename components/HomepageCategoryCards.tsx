import { Link } from "react-router-dom";
import styles from "./HomepageCategoryCards.module.css";

const categories = [
  {
    title: "Mock tests",
    imageSrc: "/_cdn/static/e2d1348d-3fb6-4161-b173-6522667d2220-Mock-Tests.svg",
    link: "/mock-test",
    tint: "tintPrimarySoft",
  },
  {
    title: "Competitions",
    imageSrc: "/_cdn/static/097c3d62-1845-4a2e-8677-2ec8ff573634-Competitions.svg",
    link: "/mock-test/live",
    tint: "tintSecondarySoft",
  },
  {
    title: "Courses",
    imageSrc: "/_cdn/static/756007b4-00c0-4749-9f70-b4b1353c05f4-Courses.svg",
    link: "/course",
    tint: "tintPrimary",
  },
  {
    title: "Study Notes",
    imageSrc: "/_cdn/static/58219409-d479-4479-80be-c495d32d574e-Study-notes.svg",
    link: "/study-notes",
    tint: "tintSecondary",
  },
];

export function HomepageCategoryCards() {
  return (
    <div className={styles.container}>
      {categories.map((cat, idx) => (
        <Link
          key={idx}
          to={cat.link}
          className={`${styles.card} ${styles[cat.tint]}`}
        >
          <div className={styles.iconWrapper}>
            <img src={cat.imageSrc} alt="" className={styles.iconImage} />
          </div>
          <h3 className={styles.title}>{cat.title}</h3>
        </Link>
      ))}
    </div>
  );
}
