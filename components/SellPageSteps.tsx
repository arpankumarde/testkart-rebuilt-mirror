import React from "react";
import { Link } from "react-router-dom";
import { Button } from "./Button";
import { useInView } from "../helpers/useInView";
import styles from "./SellPageSteps.module.css";

export const SellPageSteps: React.FC = () => {
  const [stepsRef, stepsInView] = useInView<HTMLElement>({ threshold: 0.1 });

  return (
    <section className={styles.stepsSection} ref={stepsRef}>
      <div className={styles.sectionContainer}>
        <h2 className={styles.sectionTitle}>Start Earning in 3 Simple Steps</h2>
        <div className={styles.timeline}>
          <div className={styles.timelineLine}></div>

          <div
            className={`${styles.timelineStep} ${stepsInView ? styles.stepActive : ""}`}
            style={{ transitionDelay: "0ms" }}
          >
            <div className={styles.stepNumber}>1</div>
            <div className={styles.stepContent}>
              <h3>Sign Up Free</h3>
              <p>Create your account in 2 minutes. No credit card required.</p>
            </div>
          </div>

          <div
            className={`${styles.timelineStep} ${stepsInView ? styles.stepActive : ""}`}
            style={{ transitionDelay: "300ms" }}
          >
            <div className={styles.stepNumber}>2</div>
            <div className={styles.stepContent}>
              <h3>Create with AI</h3>
              <p>
                Use our AI tools to generate comprehensive test series instantly.
              </p>
            </div>
          </div>

          <div
            className={`${styles.timelineStep} ${stepsInView ? styles.stepActive : ""}`}
            style={{ transitionDelay: "600ms" }}
          >
            <div className={styles.stepNumber}>3</div>
            <div className={styles.stepContent}>
              <h3>Earn While You Sleep</h3>
              <p>Publish your tests and get paid weekly as students enroll.</p>
            </div>
          </div>
        </div>

        <div className={styles.stepsCta}>
          <Button asChild size="lg" className={styles.glowButton}>
            <Link to="/teacher/signup">Start Your Journey Now</Link>
          </Button>
        </div>
      </div>
    </section>
  );
};