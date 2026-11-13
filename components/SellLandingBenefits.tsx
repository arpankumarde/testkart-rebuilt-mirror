import React from "react";
import {
  BarChart3,
  ClipboardCheck,
  FileText,
  Layers,
  MonitorPlay,
  Package,
  PenTool,
  Plus,
  ShieldCheck,
  Tag,
  UsersRound,
} from "lucide-react";
import { SellLandingHeading } from "./SellLandingHeading";
import styles from "./SellLandingBenefits.module.css";

const BENEFITS = [
  {
    icon: PenTool,
    tone: styles.lavender,
    title: "Easy creation and publishing",
    text: "Build tests question by question or upload them in bulk, add lessons and PDFs, then submit for a quick review.",
  },
  {
    icon: Tag,
    tone: styles.peach,
    title: "Flexible pricing and selling",
    text: "Set your own price, list free content to bring students in, and run promo codes.",
  },
  {
    icon: UsersRound,
    tone: styles.blue,
    title: "Student management",
    text: "See who enrolled in what, and sponsor seats for students from your own batches.",
  },
  {
    icon: BarChart3,
    tone: styles.mint,
    title: "Performance and sales tracking",
    text: "Follow sales, earnings and live test results from your teacher dashboard.",
  },
  {
    icon: ShieldCheck,
    tone: styles.butter,
    title: "Secure payments and withdrawals",
    text: "Students pay through a secure checkout, and you withdraw to your verified bank account.",
  },
  {
    icon: Layers,
    tone: styles.lavender,
    title: "One platform, many products",
    text: "Tests, courses, notes and bundles side by side on one public teacher profile.",
  },
];

const SAMPLE_PRODUCTS = [
  {
    icon: ClipboardCheck,
    tone: styles.lavender,
    name: "SSC CGL Full Mock Series",
    type: "Test series",
    price: "₹199",
    status: "Live",
  },
  {
    icon: MonitorPlay,
    tone: styles.blue,
    name: "Organic Chemistry Crash Course",
    type: "Course",
    price: "₹999",
    status: "Live",
  },
  {
    icon: FileText,
    tone: styles.peach,
    name: "Indian Polity Notes",
    type: "Study notes",
    price: "Free",
    status: "Live",
  },
  {
    icon: Package,
    tone: styles.mint,
    name: "NEET Biology Bundle",
    type: "Bundle",
    price: "₹1,499",
    status: "In review",
  },
];

const ProductsPreview = () => (
  <div className={styles.previewWrap} aria-hidden="true">
    <span className={styles.previewBlob} />
    <div className={styles.preview}>
      <div className={styles.previewHead}>
        <div>
          <p className={styles.previewTitle}>My products</p>
          <p className={styles.previewSub}>4 products &middot; sample data</p>
        </div>
        <span className={styles.createBtn}>
          <Plus size={14} strokeWidth={3} /> Create
        </span>
      </div>

      <ul className={styles.rows}>
        {SAMPLE_PRODUCTS.map(({ icon: Icon, tone, name, type, price, status }) => (
          <li key={name} className={styles.row}>
            <span className={`${styles.rowIcon} ${tone}`}>
              <Icon size={16} />
            </span>
            <span className={styles.rowMain}>
              <span className={styles.rowName}>{name}</span>
              <span className={styles.rowType}>{type}</span>
            </span>
            <span className={styles.rowPrice}>{price}</span>
            <span
              className={`${styles.status} ${status === "Live" ? styles.statusLive : styles.statusReview}`}
            >
              {status}
            </span>
          </li>
        ))}
      </ul>

      <div className={styles.previewFoot}>
        <span className={`${styles.footChip} ${styles.peach}`}>
          <Tag size={13} /> Promo code active
        </span>
        <span className={`${styles.footChip} ${styles.mint}`}>
          <BarChart3 size={13} /> Analytics on
        </span>
      </div>
    </div>
  </div>
);

export const SellLandingBenefits = () => (
  <section className={styles.section} aria-labelledby="sell-benefits-title">
    <div className={styles.container}>
      <div className={styles.copy}>
        <SellLandingHeading
          id="sell-benefits-title"
          align="start"
          eyebrow="Why Testkart"
          title="Everything You Need to Grow as an Educator."
          lead="The Free plan already includes unlimited tests and courses, bulk question upload, and full sales and student analytics."
          className={styles.heading}
        />

        <ul className={styles.benefits}>
          {BENEFITS.map(({ icon: Icon, tone, title, text }) => (
            <li key={title} className={styles.benefit}>
              <span className={`${styles.benefitIcon} ${tone}`} aria-hidden="true">
                <Icon size={20} />
              </span>
              <span>
                <h3 className={styles.benefitTitle}>{title}</h3>
                <p className={styles.benefitText}>{text}</p>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <ProductsPreview />
    </div>
  </section>
);
