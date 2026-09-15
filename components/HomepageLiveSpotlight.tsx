import { Link } from "react-router-dom";
import type { HomepageLiveTestSpotlight } from "../endpoints/homepage/data_GET.schema";
import { HomepageLiveSpotlightCard } from "./HomepageLiveSpotlightCard";
import styles from "./HomepageLiveSpotlight.module.css";

interface HomepageLiveSpotlightProps {
  spotlights: HomepageLiveTestSpotlight[];
}

export function HomepageLiveSpotlight({ spotlights }: HomepageLiveSpotlightProps) {
  if (!spotlights || spotlights.length === 0) return null;

  return (
    <div className={styles.sectionWrapper}>
      <div className={styles.header}>
        <h2 className={styles.title}>Live Competitive Mock Tests</h2>
        <Link to="/mock-test/live" className={styles.viewAllLink}>
          View all →
        </Link>
      </div>
      <div className={styles.cardsContainer}>
        {spotlights.map((spotlight) => (
          <HomepageLiveSpotlightCard key={spotlight.id} spotlight={spotlight} />
        ))}
      </div>
    </div>
  );
}