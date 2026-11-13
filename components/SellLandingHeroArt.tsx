import React from "react";
import {
  BarChart3,
  BookCopy,
  BookOpen,
  FileText,
  Home,
  LayoutDashboard,
  Package,
  Plus,
  Radio,
  RefreshCw,
  Users,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { getBrandLogo } from "../helpers/brandAssets";
import { useDarkModeObserver } from "../helpers/useDarkModeObserver";
import { DEFAULT_TEACHER_PLATFORM_FEE } from "../helpers/teacherPlatformFeeDefault";
import styles from "./SellLandingHeroArt.module.css";

type Tone = "mock_test" | "course" | "digital_product" | "live_test" | "bundle";

const SHARE = (100 - DEFAULT_TEACHER_PLATFORM_FEE) / 100;
const inr = (value: number) => `₹${Math.round(value).toLocaleString("en-IN")}`;

const CONTENT_NAV: { label: string; icon: LucideIcon; tone: Tone }[] = [
  { label: "Test series", icon: BookCopy, tone: "mock_test" },
  { label: "Courses", icon: BookOpen, tone: "course" },
  { label: "Notes and PDFs", icon: FileText, tone: "digital_product" },
  { label: "Live tests", icon: Radio, tone: "live_test" },
  { label: "Bundles", icon: Package, tone: "bundle" },
];

const BEST_SELLERS: { title: string; kind: string; icon: LucideIcon; tone: Tone; units: number; price: number }[] = [
  { title: "SSC CGL Full Mock Series", kind: "Test series", icon: BookCopy, tone: "mock_test", units: 41, price: 199 },
  { title: "Organic Chemistry Crash Course", kind: "Course", icon: BookOpen, tone: "course", units: 9, price: 999 },
  { title: "Indian Polity Notes", kind: "Notes and PDFs", icon: FileText, tone: "digital_product", units: 33, price: 79 },
];

const DAILY_EARNINGS = [
  22, 35, 18, 40, 28, 52, 30, 24, 46, 38, 60, 34, 42, 26, 55,
  48, 36, 64, 40, 58, 30, 70, 44, 52, 66, 38, 74, 50, 62, 82,
];
const DAILY_SALES = [
  3, 4, 2, 5, 3, 6, 4, 3, 5, 4, 7, 4, 5, 3, 6,
  5, 4, 7, 4, 6, 3, 8, 5, 6, 7, 4, 8, 5, 7, 9,
];
const MAX_SALES = 10;
const salesPoints = DAILY_SALES.map(
  (sales, index) => `${(index + 0.5) * (100 / DAILY_SALES.length)},${100 - (sales / MAX_SALES) * 100}`
).join(" ");

/*
 * A scaled screenshot-style copy of the teacher Overview page
 * (pages/teacher.dashboard.tsx): the sidebar, the pine money panel, the
 * earnings chart and best sellers, on the same console tokens the real page
 * uses. Laid out at a fixed design width in em and shrunk to the column, so it
 * reads like a product screenshot. Figures are sample data.
 */
export const SellLandingHeroArt = () => {
  const isDarkMode = useDarkModeObserver();

  return (
    <figure
      className={styles.preview}
      aria-label="Preview of the Testkart teacher dashboard Overview page with sample data"
    >
      <div className={styles.window} aria-hidden="true">
        <div className={styles.chrome}>
          <span className={styles.dots}>
            <span />
            <span />
            <span />
          </span>
          <span className={styles.url}>testkart.in/teacher/dashboard</span>
          <span className={styles.chromeSpacer} />
        </div>

        <div className={styles.app}>
          <aside className={styles.sidebar}>
            <div className={styles.brandRow}>
              <img src={getBrandLogo(isDarkMode)} alt="" className={styles.logo} />
              <span className={styles.teacherChip}>Teacher</span>
            </div>
            <span className={styles.createButton}>
              <Plus strokeWidth={2.5} /> Create
            </span>
            <nav className={styles.nav}>
              <span className={styles.navItem}>
                <Home /> Home
              </span>
              <span className={`${styles.navItem} ${styles.navActive}`}>
                <LayoutDashboard /> Dashboard
              </span>
              <span className={styles.navGroup}>Content</span>
              {CONTENT_NAV.map(({ label, icon: Icon, tone }) => (
                <span key={label} className={styles.navItem}>
                  <span className={`${styles.kindTile} ${styles[tone]}`}>
                    <Icon />
                  </span>
                  {label}
                </span>
              ))}
              <span className={styles.navGroup}>Money</span>
              <span className={styles.navItem}>
                <BarChart3 /> Earnings
              </span>
            </nav>
          </aside>

          <div className={styles.main}>
            <div className={styles.header}>
              <span className={styles.greeting}>Hi there</span>
              <span className={styles.controls}>
                <span className={styles.segmented}>
                  <span>7 days</span>
                  <span className={styles.segmentActive}>30 days</span>
                  <span>90 days</span>
                </span>
                <span className={styles.refresh}>
                  <RefreshCw />
                </span>
              </span>
            </div>

            <div className={styles.moneyPanel}>
              <div className={styles.moneyTop}>
                <div>
                  <span className={styles.moneyLabel}>Earned in 30 days</span>
                  <span className={styles.moneyAmount}>
                    {inr(18640)}
                    <span className={styles.moneyChange}>Up {inr(2310)}</span>
                  </span>
                </div>
                <span className={styles.moneyLink}>
                  Earnings <ArrowRight />
                </span>
              </div>
              <div className={styles.moneyStats}>
                <span>
                  <strong>96</strong>Sales
                </span>
                <span>
                  <strong>248</strong>Students
                </span>
                <span>
                  <strong>{inr(142860)}</strong>All time
                </span>
              </div>
            </div>

            <div className={styles.split}>
              <div className={styles.card}>
                <div className={styles.cardHead}>
                  <span className={styles.cardTitle}>Earnings and sales</span>
                  <span className={styles.legend}>
                    <span className={styles.swatchBar} /> earnings
                    <span className={styles.swatchLine} /> sales
                  </span>
                </div>
                <div className={styles.chart}>
                  <div className={styles.bars}>
                    {DAILY_EARNINGS.map((height, index) => (
                      <span key={index} style={{ height: `${height}%` }} />
                    ))}
                  </div>
                  <svg className={styles.salesLine} viewBox="0 0 100 100" preserveAspectRatio="none">
                    <polyline points={salesPoints} />
                  </svg>
                </div>
                <div className={styles.axis}>
                  <span>20 Oct</span>
                  <span>4 Nov</span>
                  <span>18 Nov</span>
                </div>
              </div>

              <div className={styles.card}>
                <div className={styles.cardHead}>
                  <span className={styles.cardTitle}>
                    Best sellers <small>last 30 days</small>
                  </span>
                </div>
                <ol className={styles.sellers}>
                  {BEST_SELLERS.map(({ title, kind, icon: Icon, tone, units, price }) => (
                    <li key={title} className={styles.seller}>
                      <span className={`${styles.thumb} ${styles[tone]}`}>
                        <Icon />
                      </span>
                      <span className={styles.sellerBody}>
                        <span className={styles.sellerTitle}>{title}</span>
                        <span className={styles.sellerMeta}>
                          {kind} &middot; {units} sales
                        </span>
                      </span>
                      <span className={styles.sellerEarnings}>{inr(price * units * SHARE)}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            <div className={styles.shelf}>
              <span className={styles.cardTitle}>Your content</span>
              <div className={styles.shelfGrid}>
                {CONTENT_NAV.map(({ label, icon: Icon, tone }, index) => (
                  <span key={label} className={`${styles.shelfTile} ${styles[tone]}`}>
                    <span className={styles.shelfHead}>
                      <span className={`${styles.kindTile} ${styles[tone]}`}>
                        <Icon />
                      </span>
                      {label}
                    </span>
                    <span className={styles.shelfCount}>{[6, 3, 8, 1, 2][index]}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <figcaption className={styles.caption}>Teacher dashboard, shown with sample data</figcaption>
    </figure>
  );
};
