import React from "react";
import { Plus, Trash2, Clock, Globe } from "lucide-react";
import { Input } from "./Input";
import { Switch } from "./Switch";
import {
  COMMON_TIMEZONES,
  DAY_NAMES,
  DAY_ORDER,
  overlapsAnother,
  rangeProblem,
  type HoursDraft,
} from "../helpers/liveTeachingForms";
import type { AvailabilityWindow } from "../endpoints/teacher/mentorship/availability/get_GET.schema";
import { FieldHint, FieldLabel } from "./LiveField";
import field from "./LiveField.module.css";
import styles from "./LiveHoursEditor.module.css";

const TimeField: React.FC<{ value: string; onChange: (value: string) => void; label: string; invalid: boolean }> = ({
  value,
  onChange,
  label,
  invalid,
}) => (
  <div className={styles.timeField}>
    <Clock size={16} aria-hidden="true" className={styles.timeIcon} />
    <Input
      type="time"
      value={value.slice(0, 5)}
      onChange={(e) => onChange(e.target.value)}
      className={`${field.input} ${styles.timeInput}`}
      aria-label={label}
      aria-invalid={invalid || undefined}
    />
  </div>
);

/*
 * The teacher's timezone and weekly hours, Monday first. Controlled: the caller
 * owns the draft and saving. Each day stacks below the card's own width.
 */
export const LiveHoursEditor: React.FC<{
  value: HoursDraft;
  onChange: (next: HoursDraft) => void;
  idPrefix: string;
}> = ({ value, onChange, idPrefix }) => {
  const windows = value.windows;
  const setWindows = (next: AvailabilityWindow[]) => onChange({ ...value, windows: next });
  const openDays = new Set(windows.filter((w) => w.isActive).map((w) => w.dayOfWeek)).size;

  const addWindow = (dayOfWeek: number) =>
    setWindows([
      ...windows,
      { id: `new-${Date.now()}-${dayOfWeek}`, dayOfWeek, startTime: "09:00", endTime: "17:00", isActive: true },
    ]);
  const updateWindow = (idx: number, patch: Partial<AvailabilityWindow>) =>
    setWindows(windows.map((w, i) => (i === idx ? { ...w, ...patch } : w)));
  const removeWindow = (idx: number) => setWindows(windows.filter((_, i) => i !== idx));

  return (
    <div className={styles.editor}>
      <div className={styles.timezoneRow}>
        <div className={styles.timezoneText}>
          <FieldLabel htmlFor={`${idPrefix}-tz`} need="required">
            Your timezone
          </FieldLabel>
          <FieldHint>Students see your open slots in their own timezone.</FieldHint>
        </div>
        <div className={styles.timezoneField}>
          <Globe size={15} aria-hidden="true" className={styles.timezoneIcon} />
          <Input
            id={`${idPrefix}-tz`}
            list={`${idPrefix}-timezones`}
            value={value.timezone}
            onChange={(e) => onChange({ ...value, timezone: e.target.value })}
            className={`${field.input} ${styles.timezoneInput}`}
            placeholder="Asia/Kolkata"
            aria-invalid={!value.timezone.trim() || undefined}
          />
          <datalist id={`${idPrefix}-timezones`}>
            {COMMON_TIMEZONES.map((tz) => (
              <option key={tz} value={tz} />
            ))}
          </datalist>
        </div>
      </div>

      <p className={styles.summary} aria-live="polite">
        {openDays === 0 ? "No open days yet." : `Open ${openDays} ${openDays === 1 ? "day" : "days"} a week.`}
      </p>

      <div className={styles.week}>
        {DAY_ORDER.map((dayIndex) => {
          const dayName = DAY_NAMES[dayIndex];
          const dayWindows = windows.map((w, i) => ({ w, i })).filter(({ w }) => w.dayOfWeek === dayIndex);
          const isOpen = dayWindows.some(({ w }) => w.isActive);
          return (
            <div key={dayIndex} className={styles.dayRow} data-open={isOpen || undefined}>
              <span className={styles.dayName}>
                <span className={styles.dayDot} aria-hidden="true" />
                {dayName}
              </span>
              <div className={styles.dayWindows}>
                {dayWindows.length === 0 && <span className={styles.dayUnavailable}>Not available</span>}
                {dayWindows.map(({ w, i }) => {
                  const problem = rangeProblem(w);
                  return (
                    <div key={w.id} className={styles.range}>
                      <div className={`${styles.rangeRow} ${w.isActive ? "" : styles.rangeOff}`}>
                        <TimeField
                          value={w.startTime}
                          onChange={(v) => updateWindow(i, { startTime: v })}
                          label={`${dayName} start time`}
                          invalid={!!problem}
                        />
                        <span className={styles.rangeTo}>to</span>
                        <TimeField
                          value={w.endTime}
                          onChange={(v) => updateWindow(i, { endTime: v })}
                          label={`${dayName} end time`}
                          invalid={!!problem}
                        />
                        <span className={styles.rangeControls}>
                          <Switch
                            checked={w.isActive}
                            onCheckedChange={(checked) => updateWindow(i, { isActive: checked })}
                            aria-label={`${dayName} hours on`}
                          />
                          <button
                            type="button"
                            className={styles.iconButton}
                            onClick={() => removeWindow(i)}
                            aria-label={`Remove ${dayName} hours`}
                          >
                            <Trash2 size={16} aria-hidden="true" />
                          </button>
                        </span>
                      </div>
                      {problem ? (
                        <p className={styles.rangeError} role="alert">
                          {problem}
                        </p>
                      ) : overlapsAnother(w, windows) ? (
                        <p className={styles.rangeWarn}>Overlaps other hours on {dayName}.</p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              <button type="button" className={styles.addHours} onClick={() => addWindow(dayIndex)}>
                <Plus size={14} aria-hidden="true" /> Add hours
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};