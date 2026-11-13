import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  ClipboardCheck,
  FileText,
  MonitorPlay,
  Package,
  Radio,
} from "lucide-react";
import { SellLandingHeading } from "./SellLandingHeading";
import styles from "./SellLandingProducts.module.css";

const PRODUCTS = [
  {
    title: "Mock Tests & Test Series",
    description:
      "Create and sell online examinations, practice tests and full test series.",
    to: "/sell/mock-test",
    icon: ClipboardCheck,
    tone: styles.lavender,
    shape: styles.shapeCircle,
  },
  {
    title: "Online Courses",
    description: "Publish structured courses and educational video content.",
    to: "/sell/courses",
    icon: MonitorPlay,
    tone: styles.blue,
    shape: styles.shapeArch,
  },
  {
    title: "Study Notes & PDFs",
    description:
      "Sell notes, previous-year papers and digital study materials.",
    to: "/sell/study-notes-pdfs",
    icon: FileText,
    tone: styles.peach,
    shape: styles.shapeDiamond,
  },
  {
    title: "Course Bundles",
    description:
      "Combine multiple educational products into one complete package.",
    to: "/sell/bundles",
    icon: Package,
    tone: styles.mint,
    shape: styles.shapeStack,
  },
];

export const SellLandingProducts = () => (
  <section className={styles.section} aria-labelledby="sell-products-title">
    <div className={styles.container}>
      <SellLandingHeading
        id="sell-products-title"
        eyebrow="What you can sell"
        title="Everything You Create, One Place to Sell."
        lead="Tests, courses, notes and bundles all live under one teacher account and one public profile."
      />

      <ul className={styles.grid}>
        {PRODUCTS.map(({ title, description, to, icon: Icon, tone, shape }) => (
          <li key={title}>
            <Link to={to} className={`${styles.card} ${tone}`}>
              <span className={`${styles.shape} ${shape}`} aria-hidden="true" />
              <span className={styles.iconTile} aria-hidden="true">
                <Icon size={24} />
              </span>
              <h3 className={styles.cardTitle}>{title}</h3>
              <p className={styles.cardText}>{description}</p>
              <span className={styles.explore}>
                Explore
                <ArrowRight size={16} aria-hidden="true" />
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <Link to="/sell/host-live-exam" className={styles.liveStrip}>
        <span className={styles.liveIcon} aria-hidden="true">
          <Radio size={18} />
        </span>
        <span className={styles.liveText}>
          Running a scholarship test or a timed live exam?{" "}
          <strong>Host a live test on Testkart</strong>
        </span>
        <ArrowUpRight size={18} aria-hidden="true" className={styles.liveArrow} />
      </Link>
    </div>
  </section>
);
