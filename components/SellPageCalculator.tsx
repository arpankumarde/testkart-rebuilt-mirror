import React, { useState } from "react";
import styles from "./SellPageCalculator.module.css";

export const SellPageCalculator: React.FC = () => {
  const [studentCount, setStudentCount] = useState(100);
  const [testPrice, setTestPrice] = useState(299);
  const commissionRate = 0.85; // 85% to teacher
  const potentialEarnings = Math.floor(
    studentCount * testPrice * commissionRate,
  );

  return (
    <section className={styles.calculatorSection}>
      <div className={styles.sectionContainer}>
        <div className={styles.calculatorCard}>
          <div className={styles.calcHeader}>
            <h2>Calculate Your Potential</h2>
            <p>See how much you could earn with just one test series.</p>
          </div>

          <div className={styles.calcBody}>
            <div className={styles.calcControls}>
              <div className={styles.controlGroup}>
                <label>
                  Students Enrolled:{" "}
                  <span className={styles.highlightValue}>{studentCount}</span>
                </label>
                <input
                  type="range"
                  min="10"
                  max="5000"
                  step="10"
                  value={studentCount}
                  onChange={(e) => setStudentCount(parseInt(e.target.value))}
                  className={styles.slider}
                />
              </div>

              <div className={styles.controlGroup}>
                <label>
                  Price per Test:{" "}
                  <span className={styles.highlightValue}>₹{testPrice}</span>
                </label>
                <input
                  type="range"
                  min="99"
                  max="999"
                  step="50"
                  value={testPrice}
                  onChange={(e) => setTestPrice(parseInt(e.target.value))}
                  className={styles.slider}
                />
              </div>
            </div>

            <div className={styles.calcResult}>
              <span className={styles.resultLabel}>
                Your Potential Earnings
              </span>
              <span className={styles.resultValue}>
                ₹{potentialEarnings.toLocaleString()}
              </span>
              <span className={styles.resultSub}>
                Based on 85% revenue share
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};