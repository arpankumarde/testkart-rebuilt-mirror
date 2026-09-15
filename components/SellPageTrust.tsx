import React from "react";
import { ShieldCheck, Users, CreditCard } from "lucide-react";
import styles from "./SellPageTrust.module.css";

interface SellPageTrustProps {
  className?: string;
}

export const SellPageTrust: React.FC<SellPageTrustProps> = ({ className }) => {
  return (
    <section className={`${styles.trustSection} ${className || ""}`}>
      <div className={styles.sectionContainer}>
        <div className={styles.trustGrid}>
          <div className={styles.trustItem}>
            <ShieldCheck className={styles.trustIcon} />
            <h3>Secure Payments</h3>
            <p>Bank-grade security for all transactions</p>
          </div>
          <div className={styles.trustItem}>
            <Users className={styles.trustIcon} />
            <h3>Trusted Community</h3>
            <p>Join 50,000+ verified educators</p>
          </div>
          <div className={styles.trustItem}>
            <CreditCard className={styles.trustIcon} />
            <h3>Guaranteed Payouts</h3>
            <p>Weekly transfers, never missed</p>
          </div>
        </div>
      </div>
    </section>
  );
};