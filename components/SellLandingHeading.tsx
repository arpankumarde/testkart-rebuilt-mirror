import React from "react";
import styles from "./SellLandingHeading.module.css";

type SellLandingHeadingProps = {
  eyebrow?: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  align?: "center" | "start";
  id?: string;
  className?: string;
};

export const SellLandingHeading = ({
  eyebrow,
  title,
  lead,
  align = "center",
  id,
  className,
}: SellLandingHeadingProps) => (
  <header
    className={`${styles.heading} ${align === "center" ? styles.center : ""} ${className ?? ""}`}
  >
    {eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}
    <h2 id={id} className={styles.title}>
      {title}
    </h2>
    {lead && <p className={styles.lead}>{lead}</p>}
  </header>
);
