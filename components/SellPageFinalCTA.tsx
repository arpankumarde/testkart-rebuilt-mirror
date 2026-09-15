import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Button } from "./Button";
import styles from "./SellPageFinalCTA.module.css";

export const SellPageFinalCTA: React.FC = () => {
  return (
    <section className={styles.finalCtaSection}>
      <div className={styles.finalCtaContent}>
        <div className={styles.urgencyBadge}>
          <span className={styles.pulseDot}></span> 127 teachers signed up
          today
        </div>
        <h2>Ready to Start Your Passive Income Journey?</h2>
        <p>Don't let another month go by trading time for money.</p>

        <Button asChild size="lg" className={styles.massiveCta}>
          <Link to="/teacher/signup">
            Create Your Free Account <ChevronRight size={24} />
          </Link>
        </Button>

        <p className={styles.riskReversal}>100% Free Forever • No Hidden Fees</p>
      </div>
    </section>
  );
};