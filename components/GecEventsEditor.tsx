import React from "react";
import { ArrowDown, ArrowUp, CalendarPlus, Trash2 } from "lucide-react";
import { Button } from "./Button";
import { Input } from "./Input";
import { Textarea } from "./Textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./Select";
import { GovtExamsStatus } from "./GovtExamsTable";
import {
  GEC_DATE_STATUSES,
  GEC_EVENT_TYPES,
  GEC_STAGE_TYPES,
  GEC_STATUSES,
  type GecEventType,
} from "../helpers/gecModel";
import { emptyGecEvent, gecInputToExam, type GecEventInput, type GecIssue } from "../helpers/gecExamInput";
import { gecEventDate, gecEventStatus } from "../helpers/gecView";
import styles from "./GecEventsEditor.module.css";

const AUTO = "__auto";

const QUICK_ADD: { type: GecEventType; label: string }[] = [
  { type: "notification", label: "Notification" },
  { type: "application_start", label: "Application start" },
  { type: "application_deadline", label: "Last date" },
  { type: "prelims", label: "Prelims" },
  { type: "mains", label: "Mains" },
  { type: "exam", label: "Exam / CBT" },
  { type: "admit_card", label: "Admit card" },
  { type: "result", label: "Result" },
];

interface GecEventsEditorProps {
  events: GecEventInput[];
  onChange: (events: GecEventInput[]) => void;
  issues: GecIssue[];
  today: string;
}

const Field: React.FC<{ label: string; htmlFor: string; error?: string; hint?: string; wide?: boolean; children: React.ReactNode }> = ({
  label,
  htmlFor,
  error,
  hint,
  wide,
  children,
}) => (
  <div className={`${styles.field} ${wide ? styles.wide : ""}`}>
    <label htmlFor={htmlFor} className={styles.label}>
      {label}
    </label>
    {children}
    {error ? <span className={styles.error}>{error}</span> : hint ? <span className={styles.hint}>{hint}</span> : null}
  </div>
);

/**
 * Every dated step of one record. Section membership is derived from these: sittings feed Next 30 days
 * and Recently concluded, last dates feed Open applications. A date that is not out yet is entered as
 * To be announced with a label, never as a guessed date.
 */
export const GecEventsEditor: React.FC<GecEventsEditorProps> = ({ events, onChange, issues, today }) => {
  const issueFor = (index: number, field: string) => issues.find((issue) => issue.path === `events.${index}.${field}`)?.message;

  const update = (index: number, patch: Partial<GecEventInput>) => onChange(events.map((event, i) => (i === index ? { ...event, ...patch } : event)));
  const move = (index: number, by: number) => {
    const next = [...events];
    const [item] = next.splice(index, 1);
    next.splice(index + by, 0, item);
    onChange(next);
  };
  const add = (type: GecEventType) => onChange([...events, emptyGecEvent(type)]);

  const preview = gecInputToExam({ ...emptyExamShell, events }, null).events;

  return (
    <div className={styles.editor}>
      {events.length === 0 && <p className={styles.empty}>No dates yet. Add the first one below; use To be announced when a date is not out.</p>}

      {events.map((event, index) => {
        const id = `gec-event-${index}`;
        const isStage = GEC_STAGE_TYPES.has(event.type);
        const isDeadline = event.type === "application_deadline";
        const tba = event.dateStatus === "tba";
        const status = gecEventStatus(preview[index], today);
        return (
          <fieldset key={event.id ?? `new-${index}`} className={styles.card}>
            <legend className={styles.srOnly}>Date {index + 1}</legend>
            <div className={styles.cardHead}>
              <span className={styles.index}>{index + 1}</span>
              <span className={styles.summary}>
                <strong>{GEC_EVENT_TYPES.find((t) => t.value === event.type)?.label}</strong>
                {event.stage ? ` - ${event.stage}` : ""}
                <span className={styles.when}>{gecEventDate(preview[index])}</span>
              </span>
              <GovtExamsStatus status={status} />
              <div className={styles.tools}>
                <Button variant="ghost" size="icon-sm" aria-label="Move up" disabled={index === 0} onClick={() => move(index, -1)}>
                  <ArrowUp size={15} />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label="Move down" disabled={index === events.length - 1} onClick={() => move(index, 1)}>
                  <ArrowDown size={15} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className={styles.danger}
                  aria-label={`Remove date ${index + 1}`}
                  onClick={() => onChange(events.filter((_, i) => i !== index))}
                >
                  <Trash2 size={15} />
                </Button>
              </div>
            </div>

            <div className={styles.grid}>
              <Field label="Event type" htmlFor={`${id}-type`} error={issueFor(index, "type")}>
                <Select value={event.type} onValueChange={(value) => update(index, { type: value as GecEventType })}>
                  <SelectTrigger id={`${id}-type`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GEC_EVENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Stage" htmlFor={`${id}-stage`} hint="As printed, e.g. Tier-I, CBT 1, Paper-I">
                <Input id={`${id}-stage`} value={event.stage ?? ""} maxLength={80} onChange={(e) => update(index, { stage: e.target.value })} />
              </Field>
              {isStage && (
                <Field label="Mode" htmlFor={`${id}-mode`} hint="Shown in Next 30 days, e.g. CBE">
                  <Input id={`${id}-mode`} value={event.mode ?? ""} maxLength={40} onChange={(e) => update(index, { mode: e.target.value })} />
                </Field>
              )}
              <Field label="Title (optional)" htmlFor={`${id}-title`}>
                <Input id={`${id}-title`} value={event.title ?? ""} maxLength={200} onChange={(e) => update(index, { title: e.target.value })} />
              </Field>

              <div className={`${styles.field} ${styles.wide}`}>
                <span className={styles.label} id={`${id}-ds`}>
                  Date status
                </span>
                <div className={styles.segments} role="radiogroup" aria-labelledby={`${id}-ds`}>
                  {GEC_DATE_STATUSES.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={event.dateStatus === option.value}
                      title={option.hint}
                      className={`${styles.segment} ${event.dateStatus === option.value ? styles.segmentOn : ""}`}
                      onClick={() =>
                        update(index, option.value === "tba" ? { dateStatus: "tba", startDate: null, endDate: null } : { dateStatus: option.value })
                      }
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {!tba && (
                <>
                  <Field label={isDeadline ? "Last date" : "Start date"} htmlFor={`${id}-start`} error={issueFor(index, "startDate")}>
                    <Input id={`${id}-start`} type="date" value={event.startDate ?? ""} onChange={(e) => update(index, { startDate: e.target.value || null })} />
                  </Field>
                  {!isDeadline && (
                    <Field label="End date (optional)" htmlFor={`${id}-end`} error={issueFor(index, "endDate")}>
                      <Input id={`${id}-end`} type="date" value={event.endDate ?? ""} min={event.startDate ?? undefined} onChange={(e) => update(index, { endDate: e.target.value || null })} />
                    </Field>
                  )}
                </>
              )}
              <Field
                label={tba ? "Label shown instead of a date" : "Display label (optional)"}
                htmlFor={`${id}-label`}
                error={tba ? undefined : issueFor(index, "startDate")}
                hint={tba ? "e.g. To be announced, Expected in June 2027, Date awaited" : "Overrides the formatted date, e.g. 6, 12 and 13 Dec 2026"}
                wide={tba}
              >
                <Input id={`${id}-label`} value={event.dateLabel ?? ""} maxLength={120} onChange={(e) => update(index, { dateLabel: e.target.value })} />
              </Field>

              <Field label="Status" htmlFor={`${id}-status`} hint={`Automatic: ${status.label}`}>
                <Select value={event.statusOverride ?? AUTO} onValueChange={(value) => update(index, { statusOverride: value === AUTO ? null : (value as GecEventInput["statusOverride"]) })}>
                  <SelectTrigger id={`${id}-status`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={AUTO}>Automatic from dates</SelectItem>
                    {GEC_STATUSES.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              {(isStage || isDeadline) && (
                <Field label={isStage ? "Next 30 days" : "Open applications"} htmlFor={`${id}-listing`} hint="Only override when the automatic rule gets it wrong">
                  <Select value={event.listingOverride} onValueChange={(value) => update(index, { listingOverride: value as GecEventInput["listingOverride"] })}>
                    <SelectTrigger id={`${id}-listing`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Automatic by date</SelectItem>
                      <SelectItem value="include">Always list until it ends</SelectItem>
                      <SelectItem value="exclude">Never list</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              )}
              {isStage && (
                <Field label="Recently concluded" htmlFor={`${id}-concluded`}>
                  <Select value={event.concludedOverride} onValueChange={(value) => update(index, { concludedOverride: value as GecEventInput["concludedOverride"] })}>
                    <SelectTrigger id={`${id}-concluded`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Automatic (latest sitting, kept about 60 days)</SelectItem>
                      <SelectItem value="include">Keep listed</SelectItem>
                      <SelectItem value="exclude">Archive (remove)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              )}

              {isStage && (
                <>
                  <Field label="What to watch for next" htmlFor={`${id}-watch`} hint="Shown once the sitting is over">
                    <Input id={`${id}-watch`} value={event.watchNext ?? ""} maxLength={300} onChange={(e) => update(index, { watchNext: e.target.value })} />
                  </Field>
                  <Field label="Result / answer key status" htmlFor={`${id}-result`} hint="e.g. Result awaited, Answer key out">
                    <Input id={`${id}-result`} value={event.resultStatus ?? ""} maxLength={120} onChange={(e) => update(index, { resultStatus: e.target.value })} />
                  </Field>
                  <Field label="Result link" htmlFor={`${id}-resulturl`} error={issueFor(index, "resultUrl")}>
                    <Input id={`${id}-resulturl`} value={event.resultUrl ?? ""} placeholder="https://" onChange={(e) => update(index, { resultUrl: e.target.value })} />
                  </Field>
                </>
              )}
              <Field label="Official source for this date" htmlFor={`${id}-source`} error={issueFor(index, "sourceUrl")}>
                <Input id={`${id}-source`} value={event.sourceUrl ?? ""} placeholder="https://" onChange={(e) => update(index, { sourceUrl: e.target.value })} />
              </Field>
              <Field label="Notes (admin only)" htmlFor={`${id}-notes`} wide>
                <Textarea id={`${id}-notes`} rows={2} value={event.notes ?? ""} maxLength={1000} onChange={(e) => update(index, { notes: e.target.value })} />
              </Field>
            </div>
          </fieldset>
        );
      })}

      <div className={styles.add}>
        <span className={styles.addLabel}>
          <CalendarPlus size={16} aria-hidden="true" /> Add a date
        </span>
        {QUICK_ADD.map((item) => (
          <Button key={item.type} variant="outline" size="sm" onClick={() => add(item.type)}>
            {item.label}
          </Button>
        ))}
      </div>
    </div>
  );
};

const emptyExamShell = {
  recordType: "exam" as const,
  category: "central" as const,
  name: "",
  tableName: null,
  shortName: null,
  conductingBody: "",
  testkartExamId: null,
  noticeNumber: null,
  postsDescription: null,
  vacancies: null,
  postName: null,
  officialUrl: null,
  notificationUrl: null,
  applyUrl: null,
  statusOverride: null,
  statusLabel: null,
  keywords: null,
  cellOverrides: {},
  sortOrder: 0,
  isHidden: false,
  verification: "unverified" as const,
  sourceNote: null,
  reviewNote: null,
};