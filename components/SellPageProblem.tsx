import React from "react";
import { Clock, Users, DollarSign } from "lucide-react";
import { useInView } from "../helpers/useInView";
import styles from "./SellPageProblem.module.css";

export const SellPageProblem: React.FC = () => {
  const [problemRef, problemInView] = useInView<HTMLElement>({
    threshold: 0.1,
  });

  return (
    <section className={styles.problemSection} ref={problemRef}>
      <div className={styles.sectionContainer}>
        <h2 className={styles.sectionTitle}>Are You Still...</h2>
        <div className={styles.painGrid}>
          <div
            className={`${styles.painCard} ${problemInView ? styles.animateIn : ""}`}
            style={{ transitionDelay: "0ms" }}
          >
            <div className={styles.painIcon}>
              <Clock size={32} />
            </div>
            <h3>Trading Time for Money?</h3>
            <p className={styles.strikethrough}>
              Teaching for hours with capped income potential
            </p>
          </div>
          <div
            className={`${styles.painCard} ${problemInView ? styles.animateIn : ""}`}
            style={{ transitionDelay: "100ms" }}
          >
            <div className={styles.painIcon}>
              <Users size={32} />
            </div>
            <h3>Struggling for Reach?</h3>
            <p className={styles.strikethrough}>
              Limited to students in your local area
            </p>
          </div>
          <div
            className={`${styles.painCard} ${problemInView ? styles.animateIn : ""}`}
            style={{ transitionDelay: "200ms" }}
          >
            <div className={styles.painIcon}>
              <DollarSign size={32} />
            </div>
            <h3>Working Harder, Not Smarter?</h3>
            <p className={styles.strikethrough}>
              Watching others succeed online while you burn out
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};