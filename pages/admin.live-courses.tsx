import React, { useRef, useState } from "react";
import { Helmet } from "react-helmet";
import { useSearchParams } from "react-router-dom";
import { CalendarDays, LayoutList, ReceiptText } from "lucide-react";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { AdminLiveCourseClassesPanel, AdminLiveCourseEnrollmentsPanel, AdminLiveCoursesPanel } from "../components/AdminLiveCoursePanels";
import { useAdminLiveCourseClassesQuery } from "../helpers/useLiveCourses";
import styles from "./admin.live-courses.module.css";

type Tab = "courses" | "classes" | "enrolments";

const TABS: { value: Tab; label: string; short?: string; icon: React.ReactNode }[] = [
  { value: "courses", label: "Courses", icon: <LayoutList /> },
  { value: "classes", label: "Classes", icon: <CalendarDays /> },
  { value: "enrolments", label: "Enrolments & refunds", short: "Enrolments", icon: <ReceiptText /> },
];

const isTab = (v: string | null): v is Tab => v === "courses" || v === "classes" || v === "enrolments";

const AdminLiveCoursesPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const tab: Tab = isTab(params.get("tab")) ? (params.get("tab") as Tab) : "courses";
  const [visited, setVisited] = useState<Set<Tab>>(() => new Set([tab]));
  if (!visited.has(tab)) setVisited(new Set(visited).add(tab));
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const unmarked = useAdminLiveCourseClassesQuery({ view: "unmarked" }).data?.classes.length ?? 0;

  const go = (next: Tab) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.set("tab", next);
        return p;
      },
      { replace: true }
    );

  const onTabKey = (e: React.KeyboardEvent, index: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const nextIndex = (index + (e.key === "ArrowRight" ? 1 : -1) + TABS.length) % TABS.length;
    go(TABS[nextIndex].value);
    tabRefs.current[nextIndex]?.focus();
  };

  return (
    <>
      <Helmet>
        <title>Live courses - Testkart Admin</title>
      </Helmet>
      <div className={styles.page}>
        <ConsolePageHeader title="Live courses" description="Multi-week live batches: courses, their classes, enrolments and refunds." />

        <nav className={styles.tabs} role="tablist" aria-label="Live courses sections">
          {TABS.map((t, i) => (
            <button
              key={t.value}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`live-courses-tab-${t.value}`}
              aria-selected={tab === t.value}
              aria-controls={`live-courses-panel-${t.value}`}
              tabIndex={tab === t.value ? 0 : -1}
              className={`${styles.tab} ${tab === t.value ? styles.tabActive : ""}`}
              onClick={() => go(t.value)}
              onKeyDown={(e) => onTabKey(e, i)}
            >
              <span className={styles.tabIcon} aria-hidden="true">
                {t.icon}
              </span>
              {t.short ? (
                <>
                  <span className={styles.labelFull}>{t.label}</span>
                  <span className={styles.labelShort} aria-hidden="true">
                    {t.short}
                  </span>
                </>
              ) : (
                t.label
              )}
              {t.value === "classes" && unmarked > 0 ? (
                <span className={styles.tabBadge} aria-label={`${unmarked} classes not marked`}>
                  {unmarked}
                </span>
              ) : null}
            </button>
          ))}
        </nav>

        {TABS.map((t) =>
          visited.has(t.value) ? (
            <div
              key={t.value}
              role="tabpanel"
              id={`live-courses-panel-${t.value}`}
              aria-labelledby={`live-courses-tab-${t.value}`}
              hidden={tab !== t.value}
              className={styles.panel}
            >
              {t.value === "courses" ? (
                <AdminLiveCoursesPanel />
              ) : t.value === "classes" ? (
                <AdminLiveCourseClassesPanel />
              ) : (
                <AdminLiveCourseEnrollmentsPanel />
              )}
            </div>
          ) : null
        )}
      </div>
    </>
  );
};

export default AdminLiveCoursesPage;
