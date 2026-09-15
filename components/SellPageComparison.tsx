import React from "react";
import { X, CheckCircle2 } from "lucide-react";
import styles from "./SellPageComparison.module.css";

export const SellPageComparison: React.FC = () => {
  return (
    <section className={styles.comparisonSection}>
      <div className={styles.sectionContainer}>
        <h2 className={styles.sectionTitle}>Why Top Educators Switch</h2>
        <div className={styles.comparisonTableWrapper}>
          <table className={styles.comparisonTable}>
            <thead>
              <tr>
                <th>Feature</th>
                <th className={styles.traditionalCol}>Traditional Teaching</th>
                <th className={styles.testkartCol}>Testkart Platform</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Income Potential</td>
                <td className={styles.negative}>
                  Capped by hours <X size={16} />
                </td>
                <td className={styles.positive}>
                  Unlimited (Passive) <CheckCircle2 size={16} />
                </td>
              </tr>
              <tr>
                <td>Reach</td>
                <td className={styles.negative}>
                  Local only <X size={16} />
                </td>
                <td className={styles.positive}>
                  Pan-India <CheckCircle2 size={16} />
                </td>
              </tr>
              <tr>
                <td>Setup Cost</td>
                <td className={styles.negative}>
                  High (Rent/Tech) <X size={16} />
                </td>
                <td className={styles.positive}>
                  ₹0 (Free) <CheckCircle2 size={16} />
                </td>
              </tr>
              <tr>
                <td>Effort</td>
                <td className={styles.negative}>
                  Active work daily <X size={16} />
                </td>
                <td className={styles.positive}>
                  Create once, earn forever <CheckCircle2 size={16} />
                </td>
              </tr>
              <tr>
                <td>Tech Skills</td>
                <td className={styles.negative}>
                  Required <X size={16} />
                </td>
                <td className={styles.positive}>
                  None needed <CheckCircle2 size={16} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};