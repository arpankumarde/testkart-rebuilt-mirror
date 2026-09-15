import React from 'react';
import { LiveTestFormValues } from '../helpers/liveTestCreationFormSchema';
import { FormItem, FormLabel, FormDescription, FormMessage } from './Form';
import { Checkbox } from './Checkbox';
import { DatePicker } from './DatePicker';
import { Clock, CalendarClock, AlertTriangle, Lock } from 'lucide-react';
import styles from './LiveTestScheduleStep.module.css';

const formatDuration = (ms: number): string => {
  const totalMinutes = Math.round(ms / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);
  return parts.join(' ');
};

const formatReadable = (date: Date): string =>
  date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

interface LiveTestScheduleStepProps {
  values: LiveTestFormValues;
  setValues: React.Dispatch<React.SetStateAction<LiveTestFormValues>>;
  // When true, every field in this step is locked. Used by the edit flow once a
  // live test has been published - students may already be relying on the
  // committed schedule. The update endpoint enforces the same lock
  // (helpers/liveTestLocks.tsx).
  disabled?: boolean;
}

export const LiveTestScheduleStep: React.FC<LiveTestScheduleStepProps> = ({ values, setValues, disabled = false }) => {
  const hasRegistrationDeadline = values.registrationDeadline !== null && values.registrationDeadline !== undefined;
  const hasStartTime = values.startTime !== null && values.startTime !== undefined;

  const windowStart = values.startTime ?? null;
  const windowEnd = values.endTime ?? null;
  const windowMs = windowStart && windowEnd ? windowEnd.getTime() - windowStart.getTime() : null;
  const windowInvalid = windowMs !== null && windowMs <= 0;

  return (
    <div className={styles.container}>
      <p className={styles.timezoneHint}>
        <Clock size={14} />
        All times below use your device&apos;s local timezone.
      </p>

      {disabled && (
        <div className={styles.lockedNotice}>
          <Lock size={14} />
          <span>Schedule is locked once a live test is published, since students may already be relying on it.</span>
        </div>
      )}

      <div className={styles.timeline}>
        <div className={styles.timelinePoint}>
          <div className={`${styles.timelineDot} ${hasRegistrationDeadline ? styles.timelineDotActive : ''}`} />
          <div className={styles.timelineConnector} />
        </div>
        <div className={styles.timelineContent}>
          <label
            htmlFor="enableRegistrationDeadline"
            className={`${styles.toggleCard} ${hasRegistrationDeadline ? styles.toggleCardActive : ''} ${disabled ? styles.toggleCardDisabled : ''}`}
          >
            <Checkbox
              id="enableRegistrationDeadline"
              checked={hasRegistrationDeadline}
              disabled={disabled}
              onChange={(e) => {
                if (e.target.checked) {
                  const fallback = values.startTime
                    ? new Date(values.startTime.getTime() - 24 * 60 * 60 * 1000)
                    : new Date(Date.now() + 24 * 60 * 60 * 1000);
                  setValues((p) => ({ ...p, registrationDeadline: fallback }));
                } else {
                  setValues((p) => ({ ...p, registrationDeadline: null }));
                }
              }}
            />
            <div className={styles.toggleContent}>
              <span className={styles.toggleTitle}>Registration deadline</span>
              <span className={styles.toggleDescription}>
                {hasRegistrationDeadline ? 'Custom deadline set below.' : 'Off - students can register until the test starts.'}
              </span>
            </div>
          </label>

          {hasRegistrationDeadline && (
            <div className={styles.fieldWrap}>
              <FormItem name="registrationDeadline">
                <FormLabel>Registration Deadline</FormLabel>
                <DatePicker
                  disabled={disabled}
                  value={values.registrationDeadline ?? undefined}
                  onChange={(date) => setValues((p) => ({ ...p, registrationDeadline: date ?? null }))}
                />
                {hasStartTime && (
                  <div className={styles.quickPicks}>
                    <button
                      type="button"
                      className={styles.quickPickButton}
                      disabled={disabled}
                      onClick={() =>
                        setValues((p) => ({
                          ...p,
                          registrationDeadline: p.startTime ? new Date(p.startTime.getTime() - 24 * 60 * 60 * 1000) : p.registrationDeadline,
                        }))
                      }
                    >
                      1 day before start
                    </button>
                    <button
                      type="button"
                      className={styles.quickPickButton}
                      disabled={disabled}
                      onClick={() =>
                        setValues((p) => ({
                          ...p,
                          registrationDeadline: p.startTime ? new Date(p.startTime.getTime() - 60 * 60 * 1000) : p.registrationDeadline,
                        }))
                      }
                    >
                      1 hour before start
                    </button>
                  </div>
                )}
                <FormDescription>Last date and time for students to enroll.</FormDescription>
                <FormMessage />
              </FormItem>
            </div>
          )}
        </div>
      </div>

      <div className={styles.timeline}>
        <div className={styles.timelinePoint}>
          <div className={`${styles.timelineDot} ${hasStartTime ? styles.timelineDotActive : ''}`} />
          <div className={styles.timelineConnector} />
        </div>
        <div className={styles.timelineContent}>
          <label
            htmlFor="enableStartTime"
            className={`${styles.toggleCard} ${hasStartTime ? styles.toggleCardActive : ''} ${disabled ? styles.toggleCardDisabled : ''}`}
          >
            <Checkbox
              id="enableStartTime"
              checked={hasStartTime}
              disabled={disabled}
              onChange={(e) => {
                if (e.target.checked) {
                  setValues((p) => ({ ...p, startTime: new Date(Date.now() + 24 * 60 * 60 * 1000) }));
                } else {
                  setValues((p) => ({ ...p, startTime: null }));
                }
              }}
            />
            <div className={styles.toggleContent}>
              <span className={styles.toggleTitle}>Test starts at a specific time</span>
              <span className={styles.toggleDescription}>
                {hasStartTime ? 'Custom start time set below.' : 'Off - students can start anytime before the test ends.'}
              </span>
            </div>
          </label>

          {hasStartTime && (
            <div className={styles.fieldWrap}>
              <FormItem name="startTime">
                <FormLabel>Start Time</FormLabel>
                <DatePicker
                  disabled={disabled}
                  value={values.startTime ?? undefined}
                  onChange={(date) => setValues((p) => ({ ...p, startTime: date ?? null }))}
                />
                <div className={styles.quickPicks}>
                  <button
                    type="button"
                    className={styles.quickPickButton}
                    disabled={disabled}
                    onClick={() => setValues((p) => ({ ...p, startTime: new Date(Date.now() + 60 * 60 * 1000) }))}
                  >
                    In 1 hour
                  </button>
                  <button
                    type="button"
                    className={styles.quickPickButton}
                    disabled={disabled}
                    onClick={() => setValues((p) => ({ ...p, startTime: new Date(Date.now() + 24 * 60 * 60 * 1000) }))}
                  >
                    Tomorrow, same time
                  </button>
                  <button
                    type="button"
                    className={styles.quickPickButton}
                    disabled={disabled}
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 1);
                      d.setHours(9, 0, 0, 0);
                      setValues((p) => ({ ...p, startTime: d }));
                    }}
                  >
                    Tomorrow, 9:00 AM
                  </button>
                </div>
                <FormDescription>When the test begins.</FormDescription>
                <FormMessage />
              </FormItem>
            </div>
          )}
        </div>
      </div>

      <div className={styles.timeline}>
        <div className={styles.timelinePoint}>
          <div className={`${styles.timelineDot} ${styles.timelineDotActive} ${styles.timelineDotFinal}`} />
        </div>
        <div className={styles.timelineContent}>
          <div className={styles.fieldWrap}>
            <FormItem name="endTime">
              <FormLabel>
                End Time <span className={styles.required}>*</span>
              </FormLabel>
              <DatePicker
                disabled={disabled}
                value={values.endTime ?? undefined}
                onChange={(date) => {
                  if (date) setValues((p) => ({ ...p, endTime: date }));
                }}
              />
              <div className={styles.quickPicks}>
                {[30, 60, 90, 120].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    className={styles.quickPickButton}
                    disabled={disabled}
                    onClick={() =>
                      setValues((p) => {
                        const base = p.startTime ?? new Date();
                        return { ...p, endTime: new Date(base.getTime() + mins * 60000) };
                      })
                    }
                  >
                    +{mins < 60 ? `${mins}m` : `${mins / 60}h`}{hasStartTime ? ' from start' : ''}
                  </button>
                ))}
              </div>
              <FormDescription>When the test ends. This is mandatory.</FormDescription>
              <FormMessage />
            </FormItem>
          </div>
        </div>
      </div>

      {windowStart && windowEnd && (
        <div className={`${styles.summaryCard} ${windowInvalid ? styles.summaryCardWarning : ''}`}>
          {windowInvalid ? <AlertTriangle size={16} /> : <CalendarClock size={16} />}
          <span>
            {windowInvalid
              ? 'End time must be after the start time.'
              : `Test window: ${formatDuration(windowMs as number)}, ${formatReadable(windowStart)} to ${formatReadable(windowEnd)}`}
          </span>
        </div>
      )}
    </div>
  );
};
