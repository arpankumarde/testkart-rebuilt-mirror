import React, { useId, useState } from "react";
import {
  BarChart3,
  BookOpen,
  ClipboardCheck,
  FileText,
  IndianRupee,
  LayoutDashboard,
  MonitorPlay,
  Package,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { DEFAULT_TEACHER_PLATFORM_FEE } from "../helpers/teacherPlatformFeeDefault";
import { SellLandingHeading } from "./SellLandingHeading";
import styles from "./SellLandingShowcase.module.css";

type TabKey = "dashboard" | "products" | "sales" | "students";

const TABS: { key: TabKey; label: string; icon: LucideIcon; path: string }[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, path: "teacher/dashboard" },
  { key: "products", label: "Products", icon: Package, path: "teacher/products" },
  { key: "sales", label: "Sales", icon: BarChart3, path: "teacher/earnings" },
  { key: "students", label: "Students", icon: UsersRound, path: "teacher/students/performance" },
];

const SHARE = (100 - DEFAULT_TEACHER_PLATFORM_FEE) / 100;
const rupees = (value: number) =>
  `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const EARNING_BARS = [34, 42, 38, 55, 48, 62, 58, 70, 64, 78, 72, 88];

const DashboardPanel = () => (
  <div className={styles.panelStack}>
    <div className={styles.statGrid}>
      {[
        { label: "Students", value: "248", icon: UsersRound, tone: styles.blue },
        { label: "Available Balance", value: "₹12,460", icon: IndianRupee, tone: styles.mint },
        { label: "Published Mock Tests", value: "9", icon: ClipboardCheck, tone: styles.lavender },
        { label: "Published Courses", value: "3", icon: MonitorPlay, tone: styles.peach },
      ].map(({ label, value, icon: Icon, tone }) => (
        <div key={label} className={styles.statCard}>
          <span className={`${styles.statIcon} ${tone}`}>
            <Icon size={15} />
          </span>
          <span className={styles.statLabel}>{label}</span>
          <span className={styles.statValue}>{value}</span>
        </div>
      ))}
    </div>
    <div className={styles.chartCard}>
      <div className={styles.chartHead}>
        <span className={styles.chartTitle}>Earnings</span>
        <span className={styles.range}>
          <span>7D</span>
          <span className={styles.rangeActive}>30D</span>
          <span>90D</span>
        </span>
      </div>
      <div className={styles.chart}>
        {EARNING_BARS.map((height, index) => (
          <span key={index} style={{ height: `${height}%` }} />
        ))}
      </div>
    </div>
  </div>
);

const PRODUCT_TILES = [
  { name: "SSC CGL Full Mock Series", type: "Test series", icon: ClipboardCheck, tone: styles.lavender, price: "₹199", sold: "112 enrolled" },
  { name: "Organic Chemistry Crash Course", type: "Course", icon: MonitorPlay, tone: styles.blue, price: "₹999", sold: "38 enrolled" },
  { name: "Indian Polity Notes", type: "Study notes", icon: FileText, tone: styles.peach, price: "Free", sold: "406 downloads" },
  { name: "NEET Biology Bundle", type: "Bundle", icon: Package, tone: styles.mint, price: "₹1,499", sold: "21 enrolled" },
  { name: "Banking Awareness PYQs", type: "Study notes", icon: BookOpen, tone: styles.butter, price: "₹79", sold: "64 downloads" },
  { name: "JEE Physics Chapter Tests", type: "Test series", icon: ClipboardCheck, tone: styles.lavender, price: "₹149", sold: "57 enrolled" },
];

const ProductsPanel = () => (
  <div className={styles.productGrid}>
    {PRODUCT_TILES.map(({ name, type, icon: Icon, tone, price, sold }) => (
      <div key={name} className={styles.productTile}>
        <span className={`${styles.productCover} ${tone}`}>
          <Icon size={20} />
        </span>
        <span className={styles.productType}>{type}</span>
        <span className={styles.productName}>{name}</span>
        <span className={styles.productMeta}>
          <strong>{price}</strong>
          {sold}
        </span>
      </div>
    ))}
  </div>
);

const SALES = [
  { date: "18 Nov", product: "SSC CGL Full Mock Series", price: 199 },
  { date: "18 Nov", product: "NEET Biology Bundle", price: 1499 },
  { date: "17 Nov", product: "Organic Chemistry Crash Course", price: 999 },
  { date: "16 Nov", product: "Banking Awareness PYQs", price: 79 },
  { date: "16 Nov", product: "JEE Physics Chapter Tests", price: 149 },
];

const SalesPanel = () => (
  <div className={styles.tableWrap}>
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Product</th>
          <th className={styles.num}>Price</th>
          <th className={styles.num}>You earned</th>
        </tr>
      </thead>
      <tbody>
        {SALES.map((sale, index) => (
          <tr key={index}>
            <td className={styles.productCell}>
              {sale.product}
              <span className={styles.saleDate}>{sale.date}</span>
            </td>
            <td className={styles.num}>{rupees(sale.price)}</td>
            <td className={`${styles.num} ${styles.earned}`}>{rupees(Math.round(sale.price * SHARE * 100) / 100)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const STUDENTS = [
  { initials: "AK", name: "Aarav K.", test: "SSC CGL Mock 03", score: 82, tone: styles.lavender },
  { initials: "PS", name: "Priya S.", test: "JEE Physics Test 5", score: 74, tone: styles.peach },
  { initials: "RM", name: "Rohit M.", test: "SSC CGL Mock 03", score: 68, tone: styles.blue },
  { initials: "SN", name: "Sneha N.", test: "NEET Bio Test 2", score: 91, tone: styles.mint },
  { initials: "VT", name: "Vikram T.", test: "JEE Physics Test 5", score: 57, tone: styles.butter },
];

const StudentsPanel = () => (
  <ul className={styles.studentList}>
    {STUDENTS.map(({ initials, name, test, score, tone }) => (
      <li key={name} className={styles.studentRow}>
        <span className={`${styles.studentAvatar} ${tone}`}>{initials}</span>
        <span className={styles.studentMain}>
          <span className={styles.studentName}>{name}</span>
          <span className={styles.studentTest}>{test}</span>
        </span>
        <span className={styles.scoreBar}>
          <span style={{ width: `${score}%` }} />
        </span>
        <span className={styles.score}>{score}%</span>
      </li>
    ))}
  </ul>
);

const PANELS: Record<TabKey, React.FC> = {
  dashboard: DashboardPanel,
  products: ProductsPanel,
  sales: SalesPanel,
  students: StudentsPanel,
};

export const SellLandingShowcase = () => {
  const [active, setActive] = useState<TabKey>("dashboard");
  const baseId = useId();
  const activeTab = TABS.find((tab) => tab.key === active) ?? TABS[0];
  const Panel = PANELS[active];

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const index = TABS.findIndex((tab) => tab.key === active);
    const step = event.key === "ArrowRight" ? 1 : -1;
    const next = TABS[(index + step + TABS.length) % TABS.length];
    setActive(next.key);
    document.getElementById(`${baseId}-tab-${next.key}`)?.focus();
  };

  return (
    <section className={styles.section} aria-labelledby="sell-showcase-title">
      <div className={styles.container}>
        <SellLandingHeading
          id="sell-showcase-title"
          eyebrow="Inside the dashboard"
          title="Your Teaching Business at a Glance."
          lead="Manage products, follow sales and see how your students perform, all from one teacher dashboard."
        />

        <div
          role="tablist"
          aria-label="Dashboard views"
          className={styles.tabs}
          onKeyDown={handleKeyDown}
        >
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              id={`${baseId}-tab-${key}`}
              type="button"
              role="tab"
              aria-selected={active === key}
              aria-controls={`${baseId}-panel`}
              tabIndex={active === key ? 0 : -1}
              className={`${styles.tab} ${active === key ? styles.tabActive : ""}`}
              onClick={() => setActive(key)}
            >
              <Icon size={16} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>

        <div className={styles.stage}>
          <span className={styles.shapeA} aria-hidden="true" />
          <span className={styles.shapeB} aria-hidden="true" />

          <div className={styles.window}>
            <div className={styles.chrome} aria-hidden="true">
              <span className={styles.dots}>
                <span />
                <span />
                <span />
              </span>
              <span className={styles.url}>testkart.in/{activeTab.path}</span>
            </div>

            <div className={styles.body}>
              <nav className={styles.sidebar} aria-hidden="true">
                {TABS.map(({ key, label, icon: Icon }) => (
                  <span
                    key={key}
                    className={`${styles.navItem} ${active === key ? styles.navActive : ""}`}
                  >
                    <Icon size={15} />
                    {label}
                  </span>
                ))}
              </nav>

              <div
                id={`${baseId}-panel`}
                role="tabpanel"
                aria-labelledby={`${baseId}-tab-${active}`}
                className={styles.panel}
              >
                <p className={styles.panelTitle}>{activeTab.label}</p>
                <Panel />
              </div>
            </div>
          </div>
        </div>

        <p className={styles.caption}>Illustrative preview with sample data.</p>
      </div>
    </section>
  );
};
