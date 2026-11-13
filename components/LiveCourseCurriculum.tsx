import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronDown, Layers, Video } from "lucide-react";
import type { OutputType as LiveCourseViewData } from "../endpoints/live-courses/get_GET.schema";
import { classroomPath } from "../helpers/liveCourseRules";
import { classesByMonth, istDayParts } from "../helpers/liveCoursePresentation";
import { openClassroom } from "../helpers/openClassroom";
import { JOIN_WINDOW_MINUTES_AFTER, JOIN_WINDOW_MINUTES_BEFORE } from "../helpers/liveLessonConfig";
import { Button } from "./Button";
import styles from "./LiveCourseCurriculum.module.css";

type Course = LiveCourseViewData["course"];

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const AccordionItem: React.FC<{
  open: boolean;
  onToggle: () => void;
  badge: React.ReactNode;
  title: string;
  meta: string;
  tone: number;
  children: React.ReactNode;
}> = ({ open, onToggle, badge, title, meta, tone, children }) => {
  const id = useId();
  return (
    <li className={styles.item} data-open={open || undefined} data-tone={tone % 4}>
      <button type="button" className={styles.trigger} aria-expanded={open} aria-controls={id} onClick={onToggle}>
        <span className={styles.badge} aria-hidden="true">
          {badge}
        </span>
        <span className={styles.triggerText}>
          <span className={styles.triggerTitle}>{title}</span>
          <span className={styles.triggerMeta}>{meta}</span>
        </span>
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
 * Syllabus and timetable as two equal-height panels whose lists scroll inside, so neither
 * column runs far past the other. The timetable opens with every month expanded and scrolled
 * to the next class.
 */
export const LiveCourseCurriculum: React.FC<{
  course: Course;
  enrolled: boolean;
  attended: Map<string, boolean>;
  now: number;
}> = ({ course, enrolled, attended, now }) => {
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

  const [openModules, setOpenModules] = useState<Set<string>>(() => new Set(course.modules[0] ? [course.modules[0].id] : []));
  const [openMonths, setOpenMonths] = useState<Set<string>>(() => new Set(months.map((g) => g.key)));

  const timetableRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = timetableRef.current;
    const row = box?.querySelector<HTMLElement>("[data-next]");
    if (!box || !row) return;
    const offset = row.getBoundingClientRect().top - box.getBoundingClientRect().top;
    if (offset > box.clientHeight * 0.6) box.scrollTop = offset - 72;
  }, []);

  const allModulesOpen = course.modules.length > 0 && openModules.size === course.modules.length;
  const allMonthsOpen = months.length > 0 && openMonths.size === months.length;
  const heldCount = course.classes.filter((c) => c.status !== "cancelled").length;
  const split = course.modules.length > 0;

  return (
    <div className={`${styles.wrap} ${split ? styles.split : ""}`}>
      {split && (
        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <h3 className={styles.h3}>
              <Layers size={17} aria-hidden="true" /> Syllabus
            </h3>
            <button
              type="button"
              className={styles.expandAll}
              onClick={() => setOpenModules(allModulesOpen ? new Set() : new Set(course.modules.map((m) => m.id)))}
            >
              {allModulesOpen ? "Collapse all" : "Expand all"}
            </button>
          </div>
          <div className={styles.scroll}>
            <ol className={styles.list}>
              {course.modules.map((m, i) => (
                <AccordionItem
                  key={m.id}
                  tone={i}
                  open={openModules.has(m.id)}
                  onToggle={() => setOpenModules((s) => toggleIn(s, m.id))}
                  badge={String(i + 1).padStart(2, "0")}
                  title={m.title}
                  meta={plural(m.topics.length, "topic", "topics")}
                >
                  {m.topics.length === 0 ? (
                    <p className={styles.empty}>Topics for this module will be added soon.</p>
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
              ))}
            </ol>
          </div>
        </div>
      )}

      <div className={styles.panel}>
        <div className={styles.panelHead}>
          <h3 className={styles.h3}>
            <CalendarDays size={17} aria-hidden="true" /> Class timetable
          </h3>
          <span className={styles.note}>Times in IST</span>
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
        {heldCount === 0 ? (
          <p className={styles.empty}>Classes will be announced soon.</p>
        ) : (
          <div ref={timetableRef} className={styles.scroll}>
            <ul className={styles.list}>
              {months.map((g, gi) => {
                const held = g.classes.filter((c) => c.status !== "cancelled");
                const minutes = held.reduce((n, c) => n + c.durationMinutes, 0);
                return (
                  <AccordionItem
                    key={g.key}
                    tone={gi + 1}
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
          </div>
        )}
      </div>
    </div>
  );
};
