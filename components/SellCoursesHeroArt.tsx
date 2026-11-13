import React from "react";
import { Check, Lock, MonitorPlay, Play, Users } from "lucide-react";
import styles from "./SellCoursesHeroArt.module.css";

type LessonState = "done" | "playing" | "next" | "preview" | "locked";

const SECTIONS: { title: string; done?: boolean; lessons?: { title: string; state: LessonState }[] }[] = [
  { title: "Section 1 · Basics", done: true },
  {
    title: "Section 2 · Motion",
    lessons: [
      { title: "Displacement", state: "done" },
      { title: "Velocity and acceleration", state: "playing" },
      { title: "Graphs of motion", state: "next" },
    ],
  },
  {
    title: "Section 3 · Forces",
    lessons: [
      { title: "Newton's laws", state: "preview" },
      { title: "Friction", state: "locked" },
    ],
  },
];

const LessonIcon = ({ state }: { state: LessonState }) => {
  if (state === "done") return <Check strokeWidth={3} />;
  if (state === "playing") return <Play />;
  if (state === "locked") return <Lock />;
  return null;
};

/*
 * The /sell/courses hero illustration: one course player window on a single
 * backdrop panel - the course header with its price and status, the video
 * lesson, and the course content list. Sizes are in em off a container-relative
 * font size, so the composition scales as one piece. Sample data only.
 */
export const SellCoursesHeroArt = () => (
  <figure
    className={styles.art}
    aria-label="Illustration of a published video course on Testkart: a lesson playing next to the course content list"
  >
    <div className={styles.stage} aria-hidden="true">
      <span className={styles.backdrop} />

      <div className={styles.window}>
        <div className={styles.head}>
          <span className={styles.thumb}>
            <MonitorPlay />
          </span>
          <span className={styles.headText}>
            <span className={styles.courseTitle}>Physics: Mechanics</span>
            <span className={styles.courseMeta}>
              24 lessons &middot; <Users /> 248 students
            </span>
          </span>
          <span className={styles.headTags}>
            <span className={styles.price}>₹999</span>
            <span className={styles.status}>Published</span>
          </span>
        </div>

        <div className={styles.body}>
          <div className={styles.lesson}>
            <div className={styles.player}>
              <span className={styles.lessonTag}>Lesson 5</span>
              <svg className={styles.slide} viewBox="0 0 200 110" preserveAspectRatio="none">
                <line className={styles.grid} x1="20" y1="30" x2="190" y2="30" />
                <line className={styles.grid} x1="20" y1="55" x2="190" y2="55" />
                <line className={styles.grid} x1="20" y1="80" x2="190" y2="80" />
                <polyline className={styles.axis} points="20,10 20,95 192,95" />
                <polyline className={styles.curve} points="20,92 60,78 100,58 140,40 180,18" />
                <circle className={styles.point} cx="100" cy="58" r="3.2" />
                <circle className={styles.point} cx="140" cy="40" r="3.2" />
              </svg>
              <div className={styles.controls}>
                <span className={styles.playBtn}>
                  <Play />
                </span>
                <span className={styles.track}>
                  <span />
                </span>
                <span className={styles.time}>08:24 / 14:10</span>
              </div>
            </div>
            <p className={styles.lessonTitle}>Velocity and acceleration</p>
            <p className={styles.lessonMeta}>Section 2 &middot; 14 min</p>
          </div>

          <div className={styles.content}>
            <p className={styles.contentTitle}>Course content</p>
            <div className={styles.progressRow}>
              <span className={styles.progressTrack}>
                <span />
              </span>
              <span className={styles.progressText}>62%</span>
            </div>
            <ul className={styles.sections}>
              {SECTIONS.map((section) => (
                <li key={section.title} className={styles.section}>
                  <span className={styles.sectionTitle}>
                    {section.title}
                    {section.done && (
                      <span className={styles.sectionDone}>
                        <Check strokeWidth={3} />
                      </span>
                    )}
                  </span>
                  {section.lessons && (
                    <ul className={styles.lessons}>
                      {section.lessons.map((lesson) => (
                        <li key={lesson.title} className={`${styles.lessonRow} ${styles[lesson.state]}`}>
                          <span className={styles.lessonDot}>
                            <LessonIcon state={lesson.state} />
                          </span>
                          <span className={styles.lessonName}>{lesson.title}</span>
                          {lesson.state === "preview" && <span className={styles.previewChip}>Preview</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  </figure>
);
