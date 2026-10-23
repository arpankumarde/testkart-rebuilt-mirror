import React from "react";
import { Link } from "react-router-dom";
import { PlayfulButton } from "./PlayfulButton";
import styles from "./GlossaryCtaBand.module.css";

interface GlossaryCtaBandProps {
  title: string;
  text?: string;
  /** Renders the buttons without links, for the admin preview. */
  preview?: boolean;
  /** Extra line under the buttons, such as the back link on a term page. */
  children?: React.ReactNode;
}

/** The band that closes the hub and every term page: its heading and the /teach and /demo buttons. */
export const GlossaryCtaBand: React.FC<GlossaryCtaBandProps> = ({ title, text, preview = false, children }) => {
  const target = (to: string, label: string) => (preview ? <span>{label}</span> : <Link to={to}>{label}</Link>);

  return (
    <section className={styles.band} aria-label="Teach on Testkart">
      <div className={styles.inner}>
        <h2 className={styles.title}>{title}</h2>
        {text && <p className={styles.text}>{text}</p>}
        <div className={styles.actions}>
          <PlayfulButton asChild size="lg" className={styles.action}>
            {target("/teach", "Start Teaching")}
          </PlayfulButton>
          <PlayfulButton asChild tone="soft" size="lg" className={styles.action}>
            {target("/demo", "Book a Demo")}
          </PlayfulButton>
        </div>
        {children}
      </div>
    </section>
  );
};