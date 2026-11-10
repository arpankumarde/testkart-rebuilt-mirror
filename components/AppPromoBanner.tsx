import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Smartphone } from "lucide-react";
import { playfulButtonClass } from "./PlayfulButton";
import styles from "./AppPromoBanner.module.css";

interface AppPromoBannerProps {
  title: string;
  text: string;
  /** Heading level for the title, so it fits the page's outline. */
  as?: "h2" | "h3";
  className?: string;
}

/** A slim peach card that points students to the /app landing page. */
export const AppPromoBanner = ({ title, text, as: Heading = "h2", className }: AppPromoBannerProps) => (
  <aside className={`${styles.banner} ${className ?? ""}`.trim()} aria-label="Testkart Android app">
    <span className={styles.icon} aria-hidden="true">
      <Smartphone size={24} strokeWidth={2} />
    </span>
    <div className={styles.copy}>
      <Heading className={styles.title}>{title}</Heading>
      <p className={styles.text}>{text}</p>
    </div>
    <Link to="/app" className={playfulButtonClass("primary", "md", styles.cta)}>
      Get the Testkart app
      <ArrowRight aria-hidden="true" />
    </Link>
  </aside>
);