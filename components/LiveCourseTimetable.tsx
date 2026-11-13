import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Video } from "lucide-react";
import type { TimetableEntry } from "../endpoints/student/live-courses/list_GET.schema";
import { JOIN_WINDOW_MINUTES_AFTER, JOIN_WINDOW_MINUTES_BEFORE } from "../helpers/liveLessonConfig";
import { classroomPath, formatIstShort } from "../helpers/liveCourseRules";
import { openClassroom } from "../helpers/openClassroom";
import { Button } from "./Button";
import { LiveSessionDateTile } from "./LiveSession";
import styles from "./LiveCourseTimetable.module.css";

const MIN = 60000;
const TONES = ["blue", "lavender", "sage", "butter", "mint"] as const;

/** Upcoming live course classes with a Join button while the classroom is open. */
export const LiveCourseTimetable: React.FC<{ entries: TimetableEntry[]; limit?: number }> = ({ entries, limit }) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);
  const shown = limit ? entries.slice(0, limit) : entries;

  return (
    <ul className={styles.list}>
      {shown.map((e, i) => {
        const start = new Date(e.startTime).getTime();
        const open = now >= start - JOIN_WINDOW_MINUTES_BEFORE * MIN && now <= start + (e.durationMinutes + JOIN_WINDOW_MINUTES_AFTER) * MIN;
        return (
          <li key={e.classId} className={styles.row}>
            <LiveSessionDateTile date={e.startTime} tone={TONES[i % TONES.length]} timeZone="Asia/Kolkata" />
            <div className={styles.body}>
              <strong className={styles.title}>{e.title}</strong>
              <Link to={`/student/live-courses/${e.courseId}`} className={styles.course}>
                {e.courseTitle}
              </Link>
              <span className={styles.meta}>
                {formatIstShort(e.startTime)} IST &middot; {e.durationMinutes} min &middot; {e.teacherName}
              </span>
            </div>
            {open && (
              <Button size="sm" onClick={() => openClassroom(classroomPath(e.classId))}>
                <Video size={14} aria-hidden="true" /> Join
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
};
