import React from "react";
import { Sparkles, Globe, TrendingUp, Zap } from "lucide-react";
import { useInView } from "../helpers/useInView";
import styles from "./SellPageSolution.module.css";

export const SellPageSolution: React.FC = () => {
  const [solutionRef, solutionInView] = useInView<HTMLElement>({
    threshold: 0.1,
  });

  return (
    <section className={styles.solutionSection} ref={solutionRef}>
      <div className={styles.sectionContainer}>
        <div className={styles.solutionHeader}>
          <span className={styles.badge}>The New Way</span>
          <h2 className={styles.sectionTitle}>
            There's a Better Way with Testkart
          </h2>
        </div>

        <div className={styles.featureGrid}>
          <div
            className={`${styles.featureCard} ${styles.glassCard} ${solutionInView ? styles.animateUp : ""}`}
          >
            <div className={styles.featureIconWrapper}>
              <Sparkles size={28} />
            </div>
            <h3>Sell Anything You Teach</h3>
            <p>From mock tests to full courses and digital notes, upload once and start selling instantly.</p>
          </div>
          <div
            className={`${styles.featureCard} ${styles.glassCard} ${solutionInView ? styles.animateUp : ""}`}
            style={{ transitionDelay: "100ms" }}
          >
            <div className={styles.featureIconWrapper}>
              <Globe size={28} />
            </div>
            <h3>Instant Reach</h3>
            <p>Your tests are instantly available to millions of students preparing for competitive exams.</p>
          </div>
          <div
            className={`${styles.featureCard} ${styles.glassCard} ${solutionInView ? styles.animateUp : ""}`}
            style={{ transitionDelay: "200ms" }}
          >
            <div className={styles.featureIconWrapper}>
              <TrendingUp size={28} />
            </div>
            <h3>Weekly Payouts</h3>
            <p>
              Get paid directly to your bank account every week. Track your
              earnings in real-time.
            </p>
          </div>
          <div
            className={`${styles.featureCard} ${styles.glassCard} ${solutionInView ? styles.animateUp : ""}`}
            style={{ transitionDelay: "300ms" }}
          >
            <div className={styles.featureIconWrapper}>
              <Zap size={28} />
            </div>
            <h3>Zero Investment</h3>
            <p>
              No platform fees, no hosting costs. You only pay a small
              commission when you make a sale.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};