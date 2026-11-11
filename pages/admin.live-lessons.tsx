import React, { useRef, useState } from "react";
import { Helmet } from "react-helmet";
import { useSearchParams } from "react-router-dom";
import { CalendarDays, Flag, Info, Ticket } from "lucide-react";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { AdminLiveCalendar } from "../components/AdminLiveCalendar";
import { AdminLiveBookings } from "../components/AdminLiveBookings";
import { AdminLiveReports } from "../components/AdminLiveReports";
import { AdminLiveDescription } from "../components/AdminLiveDescription";
import { useAdminLiveIssuesQuery } from "../helpers/useLivePackages";
import styles from "./admin.live-lessons.module.css";

type Tab = "calendar" | "bookings" | "reports" | "description";

const TABS: { value: Tab; label: string; short?: string; icon: React.ReactNode }[] = [
  { value: "calendar", label: "Calendar", icon: <CalendarDays /> },
  { value: "bookings", label: "Bookings", icon: <Ticket /> },
  { value: "reports", label: "Reports & Issues", short: "Reports", icon: <Flag /> },
  { value: "description", label: "Description", icon: <Info /> },
];

const isTab = (v: string | null): v is Tab => v === "calendar" || v === "bookings" || v === "reports" || v === "description";

const AdminLiveLessonsPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const tab: Tab = isTab(params.get("tab")) ? (params.get("tab") as Tab) : "calendar";
  const [visited, setVisited] = useState<Set<Tab>>(() => new Set([tab]));
  if (!visited.has(tab)) setVisited(new Set(visited).add(tab));
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const openReports = useAdminLiveIssuesQuery({ status: "open" }).data?.issues.length ?? 0;

  const go = (next: Tab, extra?: Record<string, string | null>) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.set("tab", next);
        for (const [k, v] of Object.entries(extra ?? {})) {
          if (v === null) p.delete(k);
          else p.set(k, v);
        }
        return p;
      },
      { replace: !extra }
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
        <title>Live Lessons - Testkart Admin</title>
      </Helmet>
      <div className={styles.page}>
        <ConsolePageHeader title="Live Lessons" description="Schedule, bookings and policies for 1:1 sessions and group lessons." />

        <nav className={styles.tabs} role="tablist" aria-label="Live lessons sections">
          {TABS.map((t, i) => (
            <button
              key={t.value}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`live-tab-${t.value}`}
              aria-selected={tab === t.value}
              aria-controls={`live-panel-${t.value}`}
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
              {t.value === "reports" && openReports > 0 ? (
                <span className={styles.tabBadge} aria-label={`${openReports} open no-show reports`}>
                  {openReports}
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
              id={`live-panel-${t.value}`}
              aria-labelledby={`live-tab-${t.value}`}
              hidden={tab !== t.value}
              className={styles.panel}
            >
              {t.value === "calendar" ? (
                <AdminLiveCalendar active={tab === "calendar"} />
              ) : t.value === "bookings" ? (
                <AdminLiveBookings active={tab === "bookings"} />
              ) : t.value === "reports" ? (
                <AdminLiveReports
                  active={tab === "reports"}
                  onOpenInCalendar={(day) => go("calendar", { view: "day", date: day, session: null })}
                />
              ) : (
                <AdminLiveDescription />
              )}
            </div>
          ) : null
        )}
      </div>
    </>
  );
};

export default AdminLiveLessonsPage;
