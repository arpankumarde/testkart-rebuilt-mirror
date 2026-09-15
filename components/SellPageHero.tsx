import React from "react";
import { Link } from "react-router-dom";
import { Button } from "./Button";
import { BookDemoButton } from "./BookDemoButton";
import { ArrowRight, Check, Play } from "lucide-react";
import { useInView } from "../helpers/useInView";
import styles from "./SellPageHero.module.css";

export const SellPageHero: React.FC = () => {
  const [heroRef, heroInView] = useInView<HTMLElement>({ threshold: 0.1 });

  return (
    <section className={styles.heroSection} ref={heroRef}>
      <div className={styles.heroBackground}>
        <div className={styles.gradientOrb1}></div>
        <div className={styles.gradientOrb2}></div>
        <div className={styles.gridOverlay}></div>
      </div>

      <div
        className={`${styles.heroContent} ${heroInView ? styles.animateFadeUp : ""}`}
      >
        <h1 className={styles.heroHeadline}>
          Sell Your Courses, Tests, and Notes.{" "}
          <span className={styles.gradientText}>Earn ₹1 Lakh+ Monthly</span>
        </h1>

        <p className={styles.heroSubheadline}>
          Build a passive income stream by selling mock tests, courses, and
          digital study notes to millions of students.
        </p>

        <div className={styles.heroCtaGroup}>
          <Button asChild size="lg" className={styles.primaryCta}>
            <Link to="/teacher/signup">
              Start Earning Today — It's Free <ArrowRight size={20} />
            </Link>
          </Button>
          <BookDemoButton size="lg" variant="outline" />
        </div>

        <div className={styles.trustIndicators}>
          <span>
            <Check size={16} /> No Credit Card
          </span>
          <span>
            <Check size={16} /> 2-Min Setup
          </span>
          <span>
            <Check size={16} /> Start Earning in 24 Hours
          </span>
        </div>
      </div>
    </section>
  );
};
