import {
  GEC_CATEGORIES,
  GEC_EVENT_TYPES,
  GEC_SECTION_IDS,
  GEC_STAGE_TYPES,
  GEC_STATUSES,
  gecLabel,
  type GecCategory,
  type GecEvent,
  type GecExam,
  type GecPageContent,
  type GecSectionId,
  type GecSnapshot,
  type GecStatus,
} from "./gecModel";

/*
 * Turns a snapshot into what the page shows on a given day (YYYY-MM-DD in India). Every
 * date-driven section is derived here, so the public page, the admin preview and the admin
 * record list always agree: Next 30 days, the category tables, Open applications and
 * Recently concluded all read the same exam records and their events.
 */

export type GecStatusTone = "open" | "upcoming" | "progress" | "concluded" | "awaited" | "tentative" | "revised" | "extended";

export interface GecStatusBadge {
  status: GecStatus;
  label: string;
  tone: GecStatusTone;
}

export interface GecRow {
  key: string;
  examId: number;
  eventId?: number;
  cells: string[];
  /** Per cell: an internal path or an external URL to link that cell to. */
  links: (string | null)[];
  months: string[];
  category: GecCategory;
  status?: GecStatusBadge;
  keywords: string;
  /** YYYY-MM-DD last date; drives the red chip in the first column. */
  deadline?: string;
}

export interface GecTable {
  id: GecSectionId;
  title: string;
  intro: string;
  note: string;
  columns: string[];
  statusColumn: boolean;
  searchPrefix: string;
  rows: GecRow[];
}

const TONES: Record<GecStatus, GecStatusTone> = {
  open: "open",
  upcoming: "upcoming",
  in_progress: "progress",
  concluded: "concluded",
  tba: "awaited",
  tentative: "tentative",
  revised: "revised",
  extended: "extended",
};

export const gecBadge = (status: GecStatus, label?: string | null): GecStatusBadge => ({
  status,
  label: label?.trim() || gecLabel(GEC_STATUSES, status),
  tone: TONES[status],
});

// ---- Dates -----------------------------------------------------------------

const SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const parts = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
};

/** "2026-11-02" to "2 Nov 2026". */
export const gecDay = (iso: string) => {
  const { y, m, d } = parts(iso);
  return `${d} ${SHORT[m - 1]} ${y}`;
};

/** "2026-11-02" to "2 November 2026". */
export const gecLongDay = (iso: string) => {
  const { y, m, d } = parts(iso);
  return `${d} ${LONG[m - 1]} ${y}`;
};

/** "2–6 Nov 2026", "30 Nov – 31 Dec 2026" or one day. */
export const gecRange = (start: string, end: string | null) => {
  if (!end || end === start) return gecDay(start);
  const a = parts(start);
  const b = parts(end);
  if (a.y === b.y && a.m === b.m) return `${a.d}–${b.d} ${SHORT[a.m - 1]} ${a.y}`;
  if (a.y === b.y) return `${a.d} ${SHORT[a.m - 1]} – ${b.d} ${SHORT[b.m - 1]} ${b.y}`;
  return `${gecDay(start)} – ${gecDay(end)}`;
};

export const gecAddDays = (iso: string, days: number) => {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

export const gecDaysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

export const gecMonthLabel = (key: string) => `${SHORT[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;

const monthsOf = (start: string | null, end: string | null): string[] => {
  if (!start) return [];
  const out: string[] = [];
  let { y, m } = parts(start);
  const last = parts(end ?? start);
  while ((y < last.y || (y === last.y && m <= last.m)) && out.length < 24) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
};

// ---- Events ----------------------------------------------------------------

export const gecEventEnd = (event: GecEvent) => event.endDate ?? event.startDate;

const isStage = (event: GecEvent) => GEC_STAGE_TYPES.has(event.type);

const byDate = (a: GecEvent, b: GecEvent) => {
  if (a.startDate && b.startDate && a.startDate !== b.startDate) return a.startDate < b.startDate ? -1 : 1;
  if (!a.startDate !== !b.startDate) return a.startDate ? -1 : 1;
  return a.sortOrder - b.sortOrder;
};

/** The date as the page prints it: the admin's label when set, else the formatted range. */
export const gecEventDate = (event: GecEvent) =>
  event.dateLabel?.trim() || (event.startDate ? gecRange(event.startDate, event.endDate) : "To be announced");

const withTentative = (event: GecEvent | undefined, text: string) =>
  event?.dateStatus === "tentative" && !/tentative/i.test(text) ? `${text} (tentative)` : text;

export const gecEventTypeLabel = (event: Pick<GecEvent, "type">) => gecLabel(GEC_EVENT_TYPES, event.type);

/** An event's status on `today`. Overrides win; a tentative date never reads as confirmed. */
export function gecEventStatus(event: GecEvent, today: string): GecStatusBadge {
  if (event.statusOverride) return gecBadge(event.statusOverride);
  if (event.dateStatus === "tba" || !event.startDate) return gecBadge("tba");
  const end = gecEventEnd(event)!;
  if (end < today) return gecBadge("concluded");
  if (event.startDate <= today) {
    return event.type === "application_deadline" || event.type === "application_start"
      ? gecBadge("open")
      : gecBadge("in_progress");
  }
  return event.dateStatus === "tentative" ? gecBadge("tentative") : gecBadge("upcoming");
}

const stageEvents = (exam: GecExam) => exam.events.filter(isStage).sort(byDate);

/** The stage that describes the exam now: the next or running sitting, else the last one held. */
export function gecCurrentStage(exam: GecExam, today: string): GecEvent | undefined {
  const stages = stageEvents(exam);
  const dated = stages.filter((event) => event.startDate);
  return (
    dated.find((event) => gecEventEnd(event)! >= today) ??
    dated[dated.length - 1] ??
    stages.find((event) => !event.startDate)
  );
}

const lastOfType = (exam: GecExam, type: GecEvent["type"]) => exam.events.filter((event) => event.type === type).sort(byDate).pop();

/**
 * Whether applications have started by `today`: the application start date, else the notification
 * date, has passed. A record with neither is treated as already open (its listing came from a live notice).
 */
const applicationsStarted = (exam: GecExam, today: string) => {
  const opener = lastOfType(exam, "application_start") ?? lastOfType(exam, "notification");
  if (!opener) return true;
  return !!opener.startDate && opener.startDate <= today && opener.dateStatus !== "tba";
};

/** True while the application window is open on `today`. */
export function gecApplicationOpen(exam: GecExam, today: string): boolean {
  const deadline = lastOfType(exam, "application_deadline");
  if (!deadline?.startDate || deadline.startDate < today || deadline.statusOverride === "concluded") return false;
  return applicationsStarted(exam, today);
}

/** One status for a whole record, as shown in the SSC, Banking and Railway tables. */
export function gecExamStatus(exam: GecExam, today: string): GecStatusBadge {
  if (exam.statusOverride) return gecBadge(exam.statusOverride, exam.statusLabel);
  if (gecApplicationOpen(exam, today)) return gecBadge("open", "Applications open");
  const current = gecCurrentStage(exam, today);
  if (!current || !current.startDate) return gecBadge("tba");
  if (current.statusOverride) return gecBadge(current.statusOverride);
  const status = gecEventStatus(current, today);
  if (status.status === "concluded") {
    const result = current.resultStatus?.trim();
    return gecBadge("concluded", result ? `Concluded, ${result.charAt(0).toLowerCase()}${result.slice(1)}` : "Concluded");
  }
  if (status.status === "in_progress") return status;
  const multiStage = stageEvents(exam).filter((event) => event.startDate).length > 1;
  return gecBadge("upcoming", multiStage && current.stage ? `${current.stage} upcoming` : "Upcoming");
}

// ---- Tokens ----------------------------------------------------------------

type Tokens = Record<string, string | null>;

/** Fills {tokens}. A sentence whose token has no value is dropped rather than printed half empty. */
const fill = (text: string, tokens: Tokens) => {
  if (!text) return "";
  const sentences = text.split(/(?<=[.!?])\s+/);
  return sentences
    .map((sentence) => {
      let missing = false;
      const out = sentence.replace(/\{(\w+)\}/g, (match, key: string) => {
        if (!(key in tokens)) return match;
        const value = tokens[key];
        if (value === null) missing = true;
        return value ?? "";
      });
      return missing ? "" : out;
    })
    .filter(Boolean)
    .join(" ");
};

// ---- View ------------------------------------------------------------------

export interface GecView {
  today: string;
  lastUpdated: { iso: string; label: string; long: string };
  page: GecPageContent;
  seo: { title: string; description: string };
  chips: { id: GecSectionId; label: string }[];
  onThisPage: { id: GecSectionId; label: string }[];
  headings: Record<GecSectionId, { title: string; intro: string; note: string }>;
  tables: {
    next30: GecTable;
    upsc: GecTable;
    ssc: GecTable;
    banking: GecTable;
    railway: GecTable;
    state: GecTable;
    open: GecTable;
    concluded: GecTable;
  };
  /** Every filterable table, in page order. */
  tableList: GecTable[];
  faqs: GecPageContent["faqs"];
  log: GecSnapshot["log"];
  monthOptions: { value: string; label: string }[];
  totalRows: number;
  urgentDays: number;
  calendar: { year: number; month: number; offset: number; days: number; marks: Record<number, string> };
}

const CALENDAR_TONES: Record<GecCategory, string> = {
  ssc: "peach",
  railway: "mint",
  banking: "powder",
  state: "butter",
  upsc: "lavender",
  central: "lavender",
};

const count = new Intl.NumberFormat("en-IN");

const examLink = (exam: GecExam) => (exam.testkartExam ? `/exams/${exam.testkartExam.slug}` : null);

const keywordsOf = (exam: GecExam) =>
  [exam.keywords, exam.conductingBody, exam.noticeNumber, exam.shortName].filter(Boolean).join(" ");

const allMonths = (exam: GecExam) => [...new Set(exam.events.flatMap((event) => monthsOf(event.startDate, event.endDate)))];

const cell = (exam: GecExam, key: string, fallback: string) => exam.cellOverrides?.[key]?.trim() || fallback;

const applyBy = (exam: GecExam, today: string) => {
  const deadline = lastOfType(exam, "application_deadline");
  if (!deadline?.startDate || deadline.startDate < today) return null;
  return `Apply by ${deadline.dateLabel?.trim() || gecDay(deadline.startDate)}`;
};

export function buildGecView(snapshot: GecSnapshot, today: string, lastUpdated: string): GecView {
  const page = snapshot.page;
  const exams = snapshot.exams.filter((exam) => !exam.isHidden);
  const settings = page.sections;
  const windowDays = settings["next-30-days"].windowDays ?? 30;
  const windowEnd = gecAddDays(today, windowDays - 1);
  const urgentDays = settings["open-applications"].urgentDays ?? 3;
  const retentionDays = settings["recently-concluded"].retentionDays ?? 60;

  const sameYear = today.slice(0, 4) === windowEnd.slice(0, 4);
  const fromLong = gecLongDay(today);
  const nextNotification = exams
    .filter((exam) => exam.category === "upsc")
    .flatMap((exam) =>
      exam.events
        .filter((event) => event.type === "notification" && event.startDate && event.startDate >= today)
        .map((event) => ({ exam, date: event.startDate! }))
    )
    .sort((a, b) => (a.date < b.date ? -1 : 1))[0];

  const tokens: Tokens = {
    updated: gecLongDay(lastUpdated),
    range: `${sameYear ? fromLong.replace(/ \d{4}$/, "") : fromLong} – ${gecLongDay(windowEnd)}`,
    from: sameYear ? fromLong.replace(/ \d{4}$/, "") : fromLong,
    to: gecLongDay(windowEnd),
    urgentDays: String(urgentDays),
    nextNotification: nextNotification
      ? `${nextNotification.exam.tableName || nextNotification.exam.name}, on ${gecLongDay(nextNotification.date)}`
      : null,
  };

  const headings = Object.fromEntries(
    GEC_SECTION_IDS.map((id) => [
      id,
      { title: fill(settings[id].title, tokens), intro: fill(settings[id].intro, tokens), note: fill(settings[id].note, tokens) },
    ])
  ) as GecView["headings"];

  const table = (id: GecSectionId, columns: string[], statusColumn: boolean, searchPrefix: string, rows: GecRow[]): GecTable => ({
    id,
    ...headings[id],
    columns: statusColumn ? [...columns, "Status"] : columns,
    statusColumn,
    searchPrefix,
    rows,
  });

  const categoryExams = (category: GecCategory) =>
    exams.filter((exam) => exam.category === category && exam.recordType === "exam").sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);

  const baseRow = (exam: GecExam, suffix = "") => ({
    key: `${exam.id}${suffix}`,
    examId: exam.id,
    months: allMonths(exam),
    category: exam.category,
    keywords: keywordsOf(exam),
  });

  // Next 30 days: every sitting that has not ended and starts inside the window.
  const next30Rows: GecRow[] = exams
    .flatMap((exam) =>
      exam.events
        .filter((event) => isStage(event) && event.startDate && event.dateStatus !== "tba")
        .filter((event) => gecEventEnd(event)! >= today)
        .filter((event) =>
          event.listingOverride === "include" ? true : event.listingOverride === "auto" && event.startDate! <= windowEnd
        )
        .map((event) => ({ exam, event }))
    )
    .sort((a, b) => byDate(a.event, b.event) || a.exam.name.localeCompare(b.exam.name))
    .slice(0, settings["next-30-days"].maxRows ?? 12)
    .map(({ exam, event }) => ({
      ...baseRow(exam, `-${event.id}`),
      eventId: event.id,
      months: monthsOf(event.startDate, event.endDate),
      cells: [
        gecEventDate(event),
        exam.name,
        [event.stage || gecEventTypeLabel(event), event.mode ? `(${event.mode})` : ""].filter(Boolean).join(" "),
        exam.conductingBody,
      ],
      links: [null, examLink(exam), null, null],
      status: gecEventStatus(event, today),
    }));

  const upscRows: GecRow[] = categoryExams("upsc").map((exam) => {
    const notification = lastOfType(exam, "notification");
    const deadline = lastOfType(exam, "application_deadline");
    const current = gecCurrentStage(exam, today);
    return {
      ...baseRow(exam),
      cells: [
        cell(exam, "exam", exam.tableName || exam.name),
        cell(exam, "notification", notification ? withTentative(notification, gecEventDate(notification)) : "–"),
        cell(exam, "lastDate", deadline ? withTentative(deadline, gecEventDate(deadline)) : "–"),
        cell(exam, "examDate", current ? withTentative(current, gecEventDate(current)) : "–"),
      ],
      links: [examLink(exam), null, null, null],
    };
  });

  const sscRows: GecRow[] = categoryExams("ssc").map((exam) => {
    const current = gecCurrentStage(exam, today);
    const start = lastOfType(exam, "application_start");
    const deadline = lastOfType(exam, "application_deadline");
    let window = "–";
    if (start && (start.endDate || start.dateLabel || !deadline?.startDate)) window = withTentative(start, gecEventDate(start));
    else if (start?.startDate && deadline?.startDate) window = withTentative(deadline, gecRange(start.startDate, deadline.startDate));
    else if (deadline) window = `Until ${withTentative(deadline, gecEventDate(deadline))}`;
    return {
      ...baseRow(exam),
      cells: [
        cell(exam, "exam", exam.tableName || exam.name),
        cell(exam, "tier", current?.stage || "–"),
        cell(exam, "window", window),
        cell(exam, "examDate", current ? withTentative(current, gecEventDate(current)) : "–"),
      ],
      links: [examLink(exam), null, null, null],
      status: gecExamStatus(exam, today),
    };
  });

  const bankingRows: GecRow[] = categoryExams("banking").map((exam) => {
    const prelims = exam.events.find((event) => event.type === "prelims");
    const mains = exam.events.find((event) => event.type === "mains");
    const single = !prelims ? exam.events.find((event) => event.type === "exam") : undefined;
    return {
      ...baseRow(exam),
      cells: [
        cell(exam, "exam", exam.tableName || exam.name),
        cell(
          exam,
          "prelims",
          prelims
            ? withTentative(prelims, gecEventDate(prelims))
            : single
              ? `Single exam: ${withTentative(single, gecEventDate(single))}`
              : "–"
        ),
        cell(exam, "mains", mains ? withTentative(mains, gecEventDate(mains)) : single ? "Not applicable" : "–"),
      ],
      links: [examLink(exam), null, null],
      status: gecExamStatus(exam, today),
    };
  });

  const railwayRows: GecRow[] = categoryExams("railway").map((exam) => {
    const current = gecCurrentStage(exam, today);
    const notice =
      [exam.noticeNumber, exam.postsDescription, exam.vacancies !== null ? `${count.format(exam.vacancies)} posts` : null]
        .filter(Boolean)
        .join(", ") || "Notice awaited";
    let stage: string;
    if (current?.startDate) {
      const date = withTentative(current, gecEventDate(current)).replace(/^From /, "from ");
      stage = current.stage ? `${current.stage}: ${date}` : date;
    } else {
      stage = [current?.dateLabel?.trim() || "Exam date awaited", applyBy(exam, today)].filter(Boolean).join(". ");
    }
    return {
      ...baseRow(exam),
      cells: [cell(exam, "exam", exam.tableName || exam.name), cell(exam, "notice", notice), cell(exam, "stage", stage)],
      links: [examLink(exam), null, null],
      status: gecExamStatus(exam, today),
    };
  });

  const stateRows: GecRow[] = categoryExams("state").map((exam) => {
    const current = gecCurrentStage(exam, today);
    const note = [current?.dateStatus === "tentative" ? "Tentative" : current?.stage, applyBy(exam, today)].filter(Boolean).join(". ");
    return {
      ...baseRow(exam),
      cells: [
        cell(exam, "commission", exam.conductingBody),
        cell(exam, "exam", exam.tableName || exam.name),
        cell(exam, "date", current ? gecEventDate(current) : "To be announced"),
        cell(exam, "note", note || "–"),
      ],
      links: [null, examLink(exam), null, null],
    };
  });

  // Open applications: every open window's last date, nearest first. Expired ones drop out; not-yet-open ones wait.
  const openRows: GecRow[] = exams
    .flatMap((exam) =>
      exam.events
        .filter(
          (event) =>
            event.type === "application_deadline" &&
            event.startDate &&
            event.startDate >= today &&
            event.listingOverride !== "exclude" &&
            event.statusOverride !== "concluded" &&
            (event.listingOverride === "include" || applicationsStarted(exam, today))
        )
        .map((event) => ({ exam, event }))
    )
    .sort((a, b) => byDate(a.event, b.event) || a.exam.conductingBody.localeCompare(b.exam.conductingBody))
    .map(({ exam, event }) => ({
      ...baseRow(exam, `-${event.id}`),
      eventId: event.id,
      months: monthsOf(event.startDate, null),
      deadline: event.startDate!,
      cells: [
        `${event.dateLabel?.trim() || gecDay(event.startDate!)}${event.statusOverride === "extended" ? " (extended)" : ""}`,
        exam.conductingBody,
        exam.postName || exam.tableName || exam.name,
        exam.vacancies !== null ? count.format(exam.vacancies) : "–",
      ],
      links: [null, null, exam.applyUrl || exam.notificationUrl || examLink(exam), null],
    }));

  // Recently concluded: each record's latest finished sitting, kept for the retention window.
  const concludedRows: GecRow[] = exams
    .flatMap((exam) => {
      const finished = exam.events
        .filter((event) => isStage(event) && event.startDate && gecEventEnd(event)! < today && event.concludedOverride !== "exclude")
        .sort(byDate);
      const latest = [...finished].reverse().find((event) => gecDaysBetween(gecEventEnd(event)!, today) <= retentionDays);
      const pinned = finished.filter((event) => event.concludedOverride === "include");
      return [...new Set([...(latest ? [latest] : []), ...pinned])].map((event) => ({ exam, event }));
    })
    .sort((a, b) => (gecEventEnd(a.event)! > gecEventEnd(b.event)! ? -1 : 1))
    .map(({ exam, event }) => ({
      ...baseRow(exam, `-${event.id}`),
      eventId: event.id,
      months: monthsOf(event.startDate, event.endDate),
      cells: [
        exam.shortName || exam.name,
        event.stage || gecEventTypeLabel(event),
        gecEventDate(event),
        event.watchNext?.trim() || event.resultStatus?.trim() || "Result awaited",
      ],
      links: [examLink(exam), null, null, event.resultUrl || null],
    }));

  const tables: GecView["tables"] = {
    next30: table("next-30-days", ["Date", "Exam", "Stage", "Conducting body"], true, "", next30Rows),
    upsc: table("upsc-2027", ["Exam", "Notification", "Last date to apply", "Exam date"], false, "upsc", upscRows),
    ssc: table("ssc-2026-27", ["Exam", "Tier / phase", "Application window", "Exam date"], true, "ssc", sscRows),
    banking: table("banking-ibps", ["Exam", "Prelims", "Mains"], true, "bank", bankingRows),
    railway: table("railway-rrb", ["Exam", "Notice", "Exam date / stage"], true, "rrb railway", railwayRows),
    state: table("state-exams", ["Commission", "Exam", "Date", "Note"], false, "state", stateRows),
    open: table("open-applications", ["Last date", "Organisation", "Post", "Vacancies"], false, "apply application", openRows),
    concluded: table("recently-concluded", ["Exam", "Stage", "Held on", "What to watch for"], false, "result", concludedRows),
  };
  const tableList = [tables.next30, tables.upsc, tables.ssc, tables.banking, tables.railway, tables.state, tables.open, tables.concluded];

  const [year, month] = today.split("-").map(Number);
  const marks: Record<number, string> = {};
  for (const row of next30Rows) {
    const event = exams.find((exam) => exam.id === row.examId)?.events.find((item) => item.id === row.eventId);
    if (event?.startDate?.startsWith(today.slice(0, 7))) {
      const day = parts(event.startDate).d;
      marks[day] = marks[day] ?? CALENDAR_TONES[row.category];
    }
  }

  return {
    today,
    lastUpdated: { iso: lastUpdated, label: gecDay(lastUpdated), long: gecLongDay(lastUpdated) },
    page,
    seo: { title: fill(page.hero.seoTitle, tokens), description: fill(page.hero.metaDescription, tokens) },
    chips: page.chips.filter((chip) => chip.visible).map((chip) => ({ id: chip.section, label: chip.label })),
    onThisPage: GEC_SECTION_IDS.filter((id) => id !== "related").map((id) => ({ id, label: settings[id].navLabel })),
    headings,
    tables,
    tableList,
    faqs: page.faqs.filter((faq) => faq.published),
    log: snapshot.log,
    monthOptions: [...new Set(tableList.flatMap((t) => t.rows.flatMap((row) => row.months)))]
      .sort()
      .map((value) => ({ value, label: gecMonthLabel(value) })),
    totalRows: tableList.reduce((total, t) => total + t.rows.length, 0),
    urgentDays,
    calendar: {
      year,
      month,
      offset: new Date(Date.UTC(year, month - 1, 1)).getUTCDay(),
      days: new Date(Date.UTC(year, month, 0)).getUTCDate(),
      marks,
    },
  };
}

/** Which public sections each record appears in, from a built view. */
export function gecMembership(view: GecView): Map<number, Set<GecSectionId>> {
  const map = new Map<number, Set<GecSectionId>>();
  for (const t of view.tableList) {
    for (const row of t.rows) {
      const set = map.get(row.examId) ?? new Set<GecSectionId>();
      set.add(t.id);
      map.set(row.examId, set);
    }
  }
  return map;
}

export const gecCategoryLabel = (category: GecCategory | undefined) =>
  GEC_CATEGORIES.find((item) => item.value === category)?.label ?? "";
