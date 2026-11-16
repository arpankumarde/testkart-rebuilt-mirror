import React, { useId, useMemo, useState } from "react";
import { CalendarDays, ChevronDown, Layers, Video } from "lucide-react";
import type { OutputType as LiveCourseViewData } from "../endpoints/live-courses/get_GET.schema";
import { classroomPath } from "../helpers/liveCourseRules";
import { classesByMonth, istDayParts } from "../helpers/liveCoursePresentation";
import { openClassroom } from "../helpers/openClassroom";
import { JOIN_WINDOW_MINUTES_AFTER, JOIN_WINDOW_MINUTES_BEFORE } from "../helpers/liveLessonConfig";
import { Button } from "./Button";
import styles from "./LiveCourseCurriculum.module.css";

type Course = LiveCourseViewData["course"];
type TabKey = "syllabus" | "timetable";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const AccordionItem: React.FC<{
  open: boolean;
  onToggle: () => void;
  badge: React.ReactNode;
  title: string;
  meta: string;
  variant: "subject" | "month";
  children: React.ReactNode;
}> = ({ open, onToggle, badge, title, meta, variant, children }) => {
  const id = useId();
  return (
    <li className={styles.item} data-variant={variant} data-open={open || undefined}>
      <button type="button" className={styles.trigger} aria-expanded={open} aria-controls={id} onClick={onToggle}>
        <span className={styles.badge} aria-hidden="true">
          {badge}
        </span>
        <span className={styles.triggerTitle}>{title}</span>
        <span className={styles.triggerMeta}>{meta}</span>
        <ChevronDown size={18} className={styles.chevron} aria-hidden="true" />
      </button>
      <div id={id} className={styles.panelBody} hidden={!open}>
        {children}
      </div>
    </li>
  );
};

const toggleIn = (set: Set<string>, key: string) => {
  const next = new Set(set);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
};

/**
 * Syllabus and class timetable as two tabs over one full-width list. Each tab is a flat
 * accordion: the syllabus groups topics under their subject, the timetable groups classes
 * under their month. The syllabus opens on its first subject; the timetable opens on the
 * month of the next class. With no subjects there is only the timetable and no tab bar.
 */
export const LiveCourseCurriculum: React.FC<{
  course: Course;
  enrolled: boolean;
  attended: Map<string, boolean>;
  now: number;
}> = ({ course, enrolled, attended, now }) => {
  const uid = useId();
  const months = useMemo(() => classesByMonth(course.classes), [course.classes]);
  const topicTitles = useMemo(() => {
    const m = new Map<string, string>();
    course.modules.forEach((mod) => mod.topics.forEach((t) => m.set(t.id, t.title)));
    return m;
  }, [course.modules]);
  const classesPerTopic = useMemo(() => {
    const m = new Map<string, number>();
    course.classes.forEach((c) => {
      if (c.topicId && c.status !== "cancelled") m.set(c.topicId, (m.get(c.topicId) ?? 0) + 1);
    });
    return m;
  }, [course.classes]);
  const nextId = useMemo(
    () => course.classes.find((c) => c.status === "scheduled" && new Date(c.startTime).getTime() + c.durationMinutes * 60000 > now)?.id,
    [course.classes, now]
  );

  const hasSyllabus = course.modules.length > 0;
  const heldCount = course.classes.filter((c) => c.status !== "cancelled").length;
  const [tab, setTab] = useState<TabKey>(hasSyllabus ? "syllabus" : "timetable");
  const [openModules, setOpenModules] = useState<Set<string>>(() => new Set(course.modules[0] ? [course.modules[0].id] : []));
  const [openMonths, setOpenMonths] = useState<Set<string>>(() => {
    const current = months.find((g) => g.classes.some((c) => c.id === nextId)) ?? months[0];
    return new Set(current ? [current.key] : []);
  });

  const allModulesOpen = hasSyllabus && openModules.size === course.modules.length;
  const allMonthsOpen = months.length > 0 && openMonths.size === months.length;

  const tabs: { key: TabKey; label: string; count: number; icon: React.ReactNode }[] = [
    { key: "syllabus", label: "Syllabus", count: course.modules.length, icon: <Layers size={16} aria-hidden="true" /> },
    { key: "timetable", label: "Class timetable", count: heldCount, icon: <CalendarDays size={16} aria-hidden="true" /> },
  ];

  const onTabKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    setTab((t) => (t === "syllabus" ? "timetable" : "syllabus"));
  };

  const syllabus = (
    <>
      <div className={styles.toolbar}>
        <span className={styles.note}>{plural(course.modules.length, "subject", "subjects")}</span>
        <button
          type="button"
          className={styles.expandAll}
          onClick={() => setOpenModules(allModulesOpen ? new Set() : new Set(course.modules.map((m) => m.id)))}
        >
          {allModulesOpen ? "Collapse all" : "Expand all"}
        </button>
      </div>
      <ol className={styles.list}>
        {course.modules.map((m, i) => {
          const moduleClasses = m.topics.reduce((n, t) => n + (classesPerTopic.get(t.id) ?? 0), 0);
          return (
            <AccordionItem
              key={m.id}
              variant="subject"
              open={openModules.has(m.id)}
              onToggle={() => setOpenModules((s) => toggleIn(s, m.id))}
              badge={String(i + 1).padStart(2, "0")}
              title={m.title}
              meta={`${plural(m.topics.length, "topic", "topics")}${moduleClasses > 0 ? ` · ${plural(moduleClasses, "class", "classes")}` : ""}`}
            >
              {m.topics.length === 0 ? (
                <p className={styles.empty}>Topics for this subject will be added soon.</p>
              ) : (
                <ol className={styles.topics}>
                  {m.topics.map((t, j) => {
                    const n = classesPerTopic.get(t.id);
                    return (
                      <li key={t.id} className={styles.topic}>
                        <span className={styles.topicNum} aria-hidden="true">
                          {i + 1}.{j + 1}
                        </span>
                        <span className={styles.topicTitle}>{t.title}</span>
                        {n ? <span className={styles.topicMeta}>{plural(n, "class", "classes")}</span> : null}
                      </li>
                    );
                  })}
                </ol>
              )}
            </AccordionItem>
          );
        })}
      </ol>
    </>
  );

  const timetable =
    heldCount === 0 ? (
      <p className={styles.empty}>Classes will be announced soon.</p>
    ) : (
      <>
        <div className={styles.toolbar}>
          <span className={styles.note}>All times in IST</span>
          {months.length > 1 && (
            <button
              type="button"
              className={styles.expandAll}
              onClick={() => setOpenMonths(allMonthsOpen ? new Set() : new Set(months.map((g) => g.key)))}
            >
              {allMonthsOpen ? "Collapse all" : "Expand all"}
            </button>
          )}
        </div>
        <ul className={styles.list}>
          {months.map((g) => {
            const held = g.classes.filter((c) => c.status !== "cancelled");
            const minutes = held.reduce((n, c) => n + c.durationMinutes, 0);
            return (
              <AccordionItem
                key={g.key}
                variant="month"
                open={openMonths.has(g.key)}
                onToggle={() => setOpenMonths((s) => toggleIn(s, g.key))}
                badge={<CalendarDays size={16} />}
                title={g.label}
                meta={`${plural(held.length, "class", "classes")} · ${minutes >= 60 ? plural(Math.round((minutes / 60) * 10) / 10, "hr", "hrs") : `${minutes} min`}`}
              >
                <ul className={styles.classes}>
                  {g.classes.map((c) => {
                    const start = new Date(c.startTime).getTime();
                    const end = start + c.durationMinutes * 60000;
                    const joinable =
                      enrolled &&
                      c.status === "scheduled" &&
                      now >= start - JOIN_WINDOW_MINUTES_BEFORE * 60000 &&
                      now <= end + JOIN_WINDOW_MINUTES_AFTER * 60000;
                    const past = end < now;
                    const mark = attended.get(c.id);
                    const parts = istDayParts(c.startTime);
                    const topic = c.topicId ? topicTitles.get(c.topicId) : undefined;
                    const isNext = c.id === nextId;
                    return (
                      <li
                        key={c.id}
                        className={`${styles.class} ${c.status === "cancelled" ? styles.cancelled : ""} ${past ? styles.past : ""}`}
                        data-next={isNext || undefined}
                      >
                        <span className={styles.date}>
                          <strong>{parts.day}</strong>
                          <span>{parts.weekday}</span>
                        </span>
                        <span className={styles.classInfo}>
                          <span className={styles.classTitle}>{c.title}</span>
                          <span className={styles.classMeta}>
                            {parts.time} &middot; {c.durationMinutes} min
                            {topic ? ` · ${topic}` : ""}
                          </span>
                        </span>
                        <span className={styles.classSide}>
                          {c.status === "cancelled" ? (
                            <span className={`${styles.tag} ${styles.tagPeach}`}>{c.missed ? "Not held" : "Cancelled"}</span>
                          ) : joinable ? (
                            <Button size="sm" onClick={() => openClassroom(classroomPath(c.id))}>
                              <Video size={14} aria-hidden="true" /> Join
                            </Button>
                          ) : enrolled && past ? (
                            <span className={`${styles.tag} ${mark ? styles.tagMint : styles.tagMuted}`}>{mark ? "Attended" : "Missed"}</span>
                          ) : past ? (
                            <span className={`${styles.tag} ${styles.tagMuted}`}>Done</span>
                          ) : isNext ? (
                            <span className={`${styles.tag} ${styles.tagBlue}`}>Next</span>
                          ) : null}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </AccordionItem>
            );
          })}
        </ul>
      </>
    );

  if (!hasSyllabus) return <div className={styles.wrap}>{timetable}</div>;

  return (
    <div className={styles.wrap}>
      <div className={styles.tabs} role="tablist" aria-label="Course content" onKeyDown={onTabKey}>
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`${uid}-tab-${t.key}`}
            aria-selected={tab === t.key}
            aria-controls={`${uid}-panel-${t.key}`}
            tabIndex={tab === t.key ? 0 : -1}
            className={styles.tab}
            onClick={() => setTab(t.key)}
          >
            {t.icon}
            {t.label}
            <span className={styles.tabCount}>{t.count}</span>
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${uid}-panel-${tab}`} aria-labelledby={`${uid}-tab-${tab}`} className={styles.tabPanel}>
        {tab === "syllabus" ? syllabus : timetable}
      </div>
    </div>
  );
};
