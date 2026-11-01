import React, { useState } from "react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { Button } from "./Button";
import { Input } from "./Input";
import { Textarea } from "./Textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./Select";
import { GovtExamsStatus } from "./GovtExamsTable";
import { GEC_EVENT_TYPES, GEC_STAGE_TYPES, GEC_STATUSES, type GecEventType } from "../helpers/gecModel";
import { emptyGecEvent, gecInputToExam, type GecEventInput, type GecExamInput, type GecIssue } from "../helpers/gecExamInput";
import { gecEventStatus } from "../helpers/gecView";
import styles from "./GecEventsEditor.module.css";

const AUTO = "__auto";

/** The one status control per date. Revised and Extended are stored as status overrides on a confirmed date. */
type DateState = "confirmed" | "tentative" | "revised" | "extended" | "tba";

const DATE_STATES: { value: DateState; label: string }[] = [
  { value: "confirmed", label: "Confirmed" },
  { value: "tentative", label: "Tentative" },
  { value: "revised", label: "Revised" },
  { value: "extended", label: "Extended" },
  { value: "tba", label: "To be announced" },
];

const stateOf = (event: GecEventInput): DateState => {
  if (event.dateStatus === "tba") return "tba";
  if (event.statusOverride === "revised" || event.statusOverride === "extended") return event.statusOverride;
  return event.dateStatus;
};

const applyState = (event: GecEventInput, state: DateState): Partial<GecEventInput> => {
  const keepOverride = event.statusOverride === "revised" || event.statusOverride === "extended" ? null : event.statusOverride;
  if (state === "tba") return { dateStatus: "tba", startDate: null, endDate: null, statusOverride: keepOverride };
  if (state === "revised" || state === "extended") return { dateStatus: "confirmed", statusOverride: state };
  return { dateStatus: state, statusOverride: keepOverride };
};

const STAGE_HINT: Partial<Record<GecEventType, string>> = {
  prelims: "e.g. Prelims",
  mains: "e.g. Mains",
  exam: "e.g. Tier-I, CBT 1",
  interview: "e.g. Interview",
  skill_test: "e.g. Skill test",
};

/** Dates every record starts with; empty ones are dropped on save. */
export const gecStarterEvents = (recordType: GecExamInput["recordType"]): GecEventInput[] =>
  (recordType === "recruitment"
    ? (["application_start", "application_deadline"] as GecEventType[])
    : (["notification", "application_start", "application_deadline", "exam"] as GecEventType[])
  ).map((type) => emptyGecEvent(type));

/** A new, untouched TBA row with no label carries nothing worth saving. */
export const gecIsBlankEvent = (event: GecEventInput) =>
  !event.id && event.dateStatus === "tba" && !event.dateLabel?.trim() && !event.stage?.trim() && !event.notes?.trim();

const ADD_TYPES: GecEventType[] = ["prelims", "mains", "exam", "interview", "skill_test", "admit_card", "exam_city", "answer_key", "result", "correction_window", "notification", "application_start", "application_deadline", "other"];

interface GecEventsEditorProps {
  events: GecEventInput[];
  onChange: (events: GecEventInput[]) => void;
  issues: GecIssue[];
  today: string;
}

/**
 * Important dates as compact rows: event, stage, status and the date (or a To be announced label).
 * Rarely used settings sit behind each row's More options. Section membership is derived from these
 * dates: sittings feed Next 30 days and Recently concluded, last dates feed Open applications.
 */
export const GecEventsEditor: React.FC<GecEventsEditorProps> = ({ events, onChange, issues, today }) => {
  const [openRow, setOpenRow] = useState<number | null>(null);
  const [adding, setAdding] = useState<GecEventType>("prelims");
  const issueFor = (index: number, field: string) => issues.find((issue) => issue.path === `events.${index}.${field}`)?.message;
  const rowIssues = (index: number) => issues.filter((issue) => issue.path.startsWith(`events.${index}.`));
  const update = (index: number, patch: Partial<GecEventInput>) => onChange(events.map((event, i) => (i === index ? { ...event, ...patch } : event)));
  const preview = gecInputToExam({ ...shell, events }, null).events;

  return (
    <div className={styles.editor}>
      {events.length > 0 && (
        <div className={styles.head} aria-hidden="true">
          <span>Event</span>
          <span>Stage</span>
          <span>Status</span>
          <span>Date</span>
          <span />
        </div>
      )}
      {events.length === 0 && <p className={styles.empty}>No dates yet. Add one below.</p>}

      {events.map((event, index) => {
        const id = `gec-event-${index}`;
        const isStage = GEC_STAGE_TYPES.has(event.type);
        const isDeadline = event.type === "application_deadline";
        const state = stateOf(event);
        const tba = state === "tba";
        const expanded = openRow === index;
        const errors = rowIssues(index);
        const derived = gecEventStatus(preview[index], today);
        return (
          <div key={event.id ?? `new-${index}`} className={`${styles.row} ${errors.length ? styles.rowError : ""}`}>
            <div className={styles.main}>
              <div className={styles.cell}>
                <label htmlFor={`${id}-type`} className={styles.mobileLabel}>
                  Event
                </label>
                <Select value={event.type} onValueChange={(value) => update(index, { type: value as GecEventType })}>
                  <SelectTrigger id={`${id}-type`} className={styles.control}>
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
              </div>
              <div className={styles.cell}>
                <label htmlFor={`${id}-stage`} className={styles.mobileLabel}>
                  Stage
                </label>
                <Input
                  id={`${id}-stage`}
                  className={styles.control}
                  value={event.stage ?? ""}
                  maxLength={80}
                  placeholder={STAGE_HINT[event.type] ?? "Optional"}
                  onChange={(e) => update(index, { stage: e.target.value })}
                />
              </div>
              <div className={styles.cell}>
                <label htmlFor={`${id}-state`} className={styles.mobileLabel}>
                  Status
                </label>
                <Select value={state} onValueChange={(value) => update(index, applyState(event, value as DateState))}>
                  <SelectTrigger id={`${id}-state`} className={styles.control}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DATE_STATES.filter((item) => item.value !== "extended" || isDeadline).map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className={`${styles.cell} ${styles.dates}`}>
                <label htmlFor={tba ? `${id}-label` : `${id}-start`} className={styles.mobileLabel}>
                  Date
                </label>
                {tba ? (
                  <Input
                    id={`${id}-label`}
                    className={styles.control}
                    value={event.dateLabel ?? ""}
                    maxLength={120}
                    placeholder="To be announced"
                    aria-label="Text shown instead of a date"
                    onChange={(e) => update(index, { dateLabel: e.target.value })}
                  />
                ) : (
                  <>
                    <Input
                      id={`${id}-start`}
                      type="date"
                      className={styles.control}
                      value={event.startDate ?? ""}
                      aria-label={isStage ? "Start date" : "Date"}
                      aria-invalid={!!issueFor(index, "startDate")}
                      onChange={(e) => update(index, { startDate: e.target.value || null })}
                    />
                    {isStage && (
                      <Input
                        id={`${id}-end`}
                        type="date"
                        className={styles.control}
                        value={event.endDate ?? ""}
                        min={event.startDate ?? undefined}
                        aria-label="End date (optional)"
                        title="End date (optional)"
                        aria-invalid={!!issueFor(index, "endDate")}
                        onChange={(e) => update(index, { endDate: e.target.value || null })}
                      />
                    )}
                  </>
                )}
              </div>
              <div className={styles.tools}>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-expanded={expanded}
                  aria-controls={`${id}-more`}
                  aria-label={expanded ? "Hide more options" : "More options"}
                  title="More options"
                  onClick={() => setOpenRow(expanded ? null : index)}
                >
                  <ChevronDown size={16} className={expanded ? styles.flip : undefined} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className={styles.danger}
                  aria-label={`Remove date ${index + 1}`}
                  onClick={() => {
                    onChange(events.filter((_, i) => i !== index));
                    setOpenRow(null);
                  }}
                >
                  <Trash2 size={15} />
                </Button>
              </div>
            </div>

            <div className={styles.meta}>
              <GovtExamsStatus status={derived} />
              {errors.map((error) => (
                <span key={error.path} className={styles.error}>
                  {error.message}
                </span>
              ))}
            </div>

            {expanded && (
              <div id={`${id}-more`} className={styles.more}>
                {!tba && (
                  <div className={styles.field}>
                    <label htmlFor={`${id}-display`} className={styles.label}>
                      Display text instead of the date
                    </label>
                    <Input
                      id={`${id}-display`}
                      value={event.dateLabel ?? ""}
                      maxLength={120}
                      placeholder="e.g. 6, 12 and 13 Dec 2026"
                      onChange={(e) => update(index, { dateLabel: e.target.value })}
                    />
                  </div>
                )}
                {isStage && (
                  <div className={styles.field}>
                    <label htmlFor={`${id}-mode`} className={styles.label}>
                      Mode
                    </label>
                    <Input id={`${id}-mode`} value={event.mode ?? ""} maxLength={40} placeholder="e.g. CBE" onChange={(e) => update(index, { mode: e.target.value })} />
                  </div>
                )}
                <div className={styles.field}>
                  <label htmlFor={`${id}-override`} className={styles.label}>
                    Override status
                  </label>
                  <Select
                    value={state === "revised" || state === "extended" ? AUTO : event.statusOverride ?? AUTO}
                    onValueChange={(value) => update(index, { statusOverride: value === AUTO ? null : (value as GecEventInput["statusOverride"]) })}
                  >
                    <SelectTrigger id={`${id}-override`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={AUTO}>Automatic: {derived.label}</SelectItem>
                      {GEC_STATUSES.filter((item) => item.value !== "revised" && item.value !== "extended").map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {(isStage || isDeadline) && (
                  <div className={styles.field}>
                    <label htmlFor={`${id}-listing`} className={styles.label}>
                      {isStage ? "In Next 30 days" : "In Open applications"}
                    </label>
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
                  </div>
                )}
                {isStage && (
                  <>
                    <div className={styles.field}>
                      <label htmlFor={`${id}-concluded`} className={styles.label}>
                        In Recently concluded
                      </label>
                      <Select value={event.concludedOverride} onValueChange={(value) => update(index, { concludedOverride: value as GecEventInput["concludedOverride"] })}>
                        <SelectTrigger id={`${id}-concluded`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">Automatic (about 60 days)</SelectItem>
                          <SelectItem value="include">Keep listed</SelectItem>
                          <SelectItem value="exclude">Archive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className={styles.field}>
                      <label htmlFor={`${id}-watch`} className={styles.label}>
                        What to watch for next
                      </label>
                      <Input id={`${id}-watch`} value={event.watchNext ?? ""} maxLength={300} placeholder="Shown after the sitting" onChange={(e) => update(index, { watchNext: e.target.value })} />
                    </div>
                    <div className={styles.field}>
                      <label htmlFor={`${id}-result`} className={styles.label}>
                        Result / answer key status
                      </label>
                      <Input id={`${id}-result`} value={event.resultStatus ?? ""} maxLength={120} placeholder="e.g. Result awaited" onChange={(e) => update(index, { resultStatus: e.target.value })} />
                    </div>
                    <div className={styles.field}>
                      <label htmlFor={`${id}-resulturl`} className={styles.label}>
                        Result link
                      </label>
                      <Input id={`${id}-resulturl`} value={event.resultUrl ?? ""} placeholder="https://" onChange={(e) => update(index, { resultUrl: e.target.value })} />
                      {issueFor(index, "resultUrl") && <span className={styles.error}>{issueFor(index, "resultUrl")}</span>}
                    </div>
                  </>
                )}
                <div className={styles.field}>
                  <label htmlFor={`${id}-source`} className={styles.label}>
                    Official source for this date
                  </label>
                  <Input id={`${id}-source`} value={event.sourceUrl ?? ""} placeholder="https://" onChange={(e) => update(index, { sourceUrl: e.target.value })} />
                  {issueFor(index, "sourceUrl") && <span className={styles.error}>{issueFor(index, "sourceUrl")}</span>}
                </div>
                <div className={`${styles.field} ${styles.wide}`}>
                  <label htmlFor={`${id}-notes`} className={styles.label}>
                    Admin note
                  </label>
                  <Textarea id={`${id}-notes`} rows={2} value={event.notes ?? ""} maxLength={1000} onChange={(e) => update(index, { notes: e.target.value })} />
                </div>
              </div>
            )}
          </div>
        );
      })}

      <div className={styles.add}>
        <Select value={adding} onValueChange={(value) => setAdding(value as GecEventType)}>
          <SelectTrigger className={styles.addSelect} aria-label="Type of date to add">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ADD_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {GEC_EVENT_TYPES.find((item) => item.value === type)?.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => onChange([...events, emptyGecEvent(adding)])}>
          <Plus size={15} /> Add date
        </Button>
        <span className={styles.hint}>Leave a new date as To be announced with no text to skip it.</span>
      </div>
    </div>
  );
};

const shell: Omit<GecExamInput, "events"> = {
  recordType: "exam",
  category: "central",
  name: "",
  tableName: null,
  shortName: null,
  conductingBody: "",
  testkartExamId: null,
  newsPostId: null,
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
  verification: "unverified",
  sourceNote: null,
  reviewNote: null,
};
