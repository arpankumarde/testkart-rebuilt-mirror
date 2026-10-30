import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import type { GecPageContent } from "../helpers/gecModel";
import styles from "./GovtExamsCtaBand.module.css";

/** The one mid-page CTA: a quiet sage band, copy on the left and a charcoal button on the right. */
export const GovtExamsCtaBand: React.FC<{ cta: GecPageContent["cta"] }> = ({ cta }) => {
  const content = (
    <>
      {cta.buttonLabel}
      <ArrowRight size={18} aria-hidden="true" className={styles.arrow} />
    </>
  );
  return (
    <section className={styles.band} aria-labelledby="gec-cta-title">
      <div className={styles.content}>
        {cta.eyebrow && <span className={styles.label}>{cta.eyebrow}</span>}
        <p id="gec-cta-title" className={styles.title}>
          {cta.title}
        </p>
        {cta.text && <p className={styles.text}>{cta.text}</p>}
      </div>
      {cta.url.startsWith("/") ? (
        <Link to={cta.url} className={styles.button}>
          {content}
        </Link>
      ) : cta.url ? (
        <a href={cta.url} className={styles.button} target="_blank" rel="noopener noreferrer">
          {content}
        </a>
      ) : (
        <span className={styles.button}>{content}</span>
      )}
    </section>
  );
};