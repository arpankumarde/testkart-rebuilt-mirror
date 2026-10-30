import superjson from "superjson";
import { sql, type Kysely, type Transaction } from "kysely";
import { db } from "./db";
import type { DB, GecCategory, GecStatus, GecVerification } from "./schema";
import { jsonbParam } from "./jsonbParam";
import { ForbiddenError, NotAuthenticatedError } from "./getAdminSession";
import {
  GEC_CATEGORIES,
  GEC_CATEGORY_SECTION,
  GEC_EVENT_TYPES,
  gecBlock,
  gecLabel,
  gecPageSchema,
  mergeGecBlock,
  type GecBlockKey,
  type GecExam,
  type GecPageContent,
  type GecPublicPayload,
  type GecSectionId,
  type GecSnapshot,
} from "./gecModel";
import {
  buildGecView,
  gecDay,
  gecEventDate,
  gecExamStatus,
  gecMembership,
  type GecStatusBadge,
} from "./gecView";
import {
  gecExamInputSchema,
  gecExamToInput,
  validateGecExam,
  type GecExamInput,
  type GecExamParsed,
  type GecIssue,
} from "./gecExamInput";
import { GEC_CSV_HEADER, gecCsvParse, gecCsvStringify } from "./gecCsv";
import { todayInIndia } from "./govtExamsCalendarFilter";

type Executor = Kysely<DB> | Transaction<DB>;

export class GecInputError extends Error {
  issues: GecIssue[];
  constructor(message: string, issues: GecIssue[] = []) {
    super(message);
    this.name = "GecInputError";
    this.issues = issues;
  }
}

class GecNotFoundError extends Error {}

// ---- Snapshots and publications --------------------------------------------

async function loadSnapshot(includeAdmin: boolean, executor: Executor = db): Promise<GecSnapshot> {
  const result = await sql<{ snapshot: GecSnapshot }>`select gec_build_snapshot(${includeAdmin}) as snapshot`.execute(executor);
  return result.rows[0].snapshot;
}

async function latestPublication(executor: Executor = db) {
  return executor
    .selectFrom("gecPublications")
    .leftJoin("admins", "admins.id", "gecPublications.publishedByAdminId")
    .select([
      "gecPublications.id",
      "gecPublications.snapshot",
      "gecPublications.summary",
      "gecPublications.publishedAt",
      sql<string>`to_char(gec_publications.last_updated, 'YYYY-MM-DD')`.as("lastUpdated"),
      "admins.fullName as publishedBy",
    ])
    .orderBy("gecPublications.publishedAt", "desc")
    .orderBy("gecPublications.id", "desc")
    .limit(1)
    .executeTakeFirst();
}

/** What the public page renders: the latest published snapshot only. Drafts never reach it. */
async function loadPublic(): Promise<GecPublicPayload> {
  const publication = await latestPublication();
  if (!publication) throw new Error("The calendar has not been published yet");
  return { snapshot: publication.snapshot as unknown as GecSnapshot, lastUpdated: publication.lastUpdated, today: todayInIndia() };
}

/** The working copy as the public page would show it after Publish, for previews. */
async function loadDraftPayload(): Promise<GecPublicPayload> {
  const today = todayInIndia();
  return { snapshot: await loadSnapshot(false), lastUpdated: today, today };
}

async function pendingChangeCount(since: Date | null, executor: Executor = db) {
  let query = executor
    .selectFrom("gecUpdateLog")
    .select(sql<number>`count(*)::int`.as("count"))
    .where("kind", "in", ["auto", "manual"]);
  if (since) query = query.where("createdAt", ">", since);
  return (await query.executeTakeFirstOrThrow()).count;
}

async function adminMeta() {
  const publication = await latestPublication();
  const pending = await pendingChangeCount(publication ? new Date(publication.publishedAt) : null);
  const page = await db.selectFrom("gecPage").select(["draftUpdatedAt"]).where("id", "=", 1).executeTakeFirst();
  return {
    today: todayInIndia(),
    pendingChanges: pending,
    draftUpdatedAt: page ? new Date(page.draftUpdatedAt).toISOString() : null,
    publication: publication
      ? {
          id: publication.id,
          publishedAt: new Date(publication.publishedAt).toISOString(),
          lastUpdated: publication.lastUpdated,
          publishedBy: publication.publishedBy ?? null,
          summary: publication.summary,
        }
      : null,
  };
}

export type GecAdminMeta = Awaited<ReturnType<typeof adminMeta>>;

// ---- Update log ------------------------------------------------------------

async function logChange(
  executor: Executor,
  entry: { adminId: number | null; section: string; summary: string; kind?: "auto" | "manual" | "publish"; isPublic?: boolean; logDate?: string }
) {
  const row = await executor
    .insertInto("gecUpdateLog")
    .values({
      kind: entry.kind ?? "auto",
      section: entry.section.slice(0, 120),
      summary: entry.summary.slice(0, 1000),
      isPublic: entry.isPublic ?? false,
      adminId: entry.adminId,
      ...(entry.logDate ? { logDate: entry.logDate } : {}),
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  return row.id;
}

async function listLog(input: { page: number; limit: number }) {
  const offset = (input.page - 1) * input.limit;
  const [rows, total] = await Promise.all([
    db
      .selectFrom("gecUpdateLog")
      .leftJoin("admins", "admins.id", "gecUpdateLog.adminId")
      .select([
        "gecUpdateLog.id",
        "gecUpdateLog.kind",
        "gecUpdateLog.section",
        "gecUpdateLog.summary",
        "gecUpdateLog.isPublic",
        "gecUpdateLog.publicationId",
        "gecUpdateLog.createdAt",
        sql<string>`to_char(gec_update_log.log_date, 'YYYY-MM-DD')`.as("logDate"),
        "admins.fullName as adminName",
      ])
      .orderBy("gecUpdateLog.createdAt", "desc")
      .orderBy("gecUpdateLog.id", "desc")
      .limit(input.limit)
      .offset(offset)
      .execute(),
    db.selectFrom("gecUpdateLog").select(sql<number>`count(*)::int`.as("count")).executeTakeFirstOrThrow(),
  ]);
  return {
    rows: rows.map((row) => ({ ...row, createdAt: new Date(row.createdAt).toISOString() })),
    total: total.count,
    totalPages: Math.max(1, Math.ceil(total.count / input.limit)),
  };
}

async function addLogNote(input: { summary: string; section: string; isPublic: boolean; logDate: string }, adminId: number) {
  return logChange(db, { adminId, kind: "manual", section: input.section, summary: input.summary, isPublic: input.isPublic, logDate: input.logDate });
}

async function deleteLogNote(id: number) {
  const removed = await db.deleteFrom("gecUpdateLog").where("id", "=", id).where("kind", "=", "manual").returning("id").executeTakeFirst();
  if (!removed) throw new GecInputError("Only manual notes can be deleted");
}

// ---- Admin list ------------------------------------------------------------

export const GEC_ADMIN_TABS = ["all", "next30", "upsc", "ssc", "banking", "railway", "state", "open", "concluded"] as const;
export type GecAdminTab = (typeof GEC_ADMIN_TABS)[number];

const TAB_SECTIONS: Partial<Record<GecAdminTab, GecSectionId>> = {
  next30: "next-30-days",
  open: "open-applications",
  concluded: "recently-concluded",
};

export interface GecAdminListInput {
  tab: GecAdminTab;
  search?: string;
  category?: GecCategory;
  status?: GecStatus;
  verification?: GecVerification;
  month?: string;
  year?: string;
  page: number;
  limit: number;
}

export interface GecAdminRow {
  id: number;
  slug: string;
  name: string;
  recordType: GecExam["recordType"];
  category: GecCategory;
  conductingBody: string;
  testkartExamName: string | null;
  isHidden: boolean;
  verification: GecVerification;
  verifiedAt: string | null;
  reviewNote: string | null;
  updatedAt: string | null;
  status: GecStatusBadge;
  sections: GecSectionId[];
  keyDate: { label: string; detail: string; deadline: string | null; eventId: number | null } | null;
  eventCount: number;
  hasTbaDates: boolean;
}

const normalise = (text: string) => text.toLowerCase().replace(/[–—-]/g, " ").replace(/\s+/g, " ").trim();

async function listExams(input: GecAdminListInput) {
  const snapshot = await loadSnapshot(true);
  const today = todayInIndia();
  const view = buildGecView(snapshot, today, today);
  const membership = gecMembership(view);
  const exams = snapshot.exams;

  const rowFor = (exam: GecExam, tab: GecAdminTab): GecAdminRow => {
    const sections = [...(membership.get(exam.id) ?? [])];
    let keyDate: GecAdminRow["keyDate"] = null;
    const tableRow = (section: GecSectionId) =>
      view.tableList.find((t) => t.id === section)?.rows.find((row) => row.examId === exam.id);
    if (tab === "next30" && tableRow("next-30-days")) {
      const row = tableRow("next-30-days")!;
      keyDate = { label: row.cells[0], detail: row.cells[2], deadline: null, eventId: row.eventId ?? null };
    } else if (tab === "open" && tableRow("open-applications")) {
      const row = tableRow("open-applications")!;
      keyDate = { label: row.cells[0], detail: "Last date to apply", deadline: row.deadline ?? null, eventId: row.eventId ?? null };
    } else if (tab === "concluded" && tableRow("recently-concluded")) {
      const row = tableRow("recently-concluded")!;
      keyDate = { label: row.cells[2], detail: `${row.cells[1]} held`, deadline: null, eventId: row.eventId ?? null };
    } else {
      const dated = exam.events.filter((event) => event.startDate).sort((a, b) => (a.startDate! < b.startDate! ? -1 : 1));
      const next = dated.find((event) => (event.endDate ?? event.startDate)! >= today) ?? dated[dated.length - 1];
      if (next) {
        keyDate = {
          label: gecEventDate(next),
          detail: next.stage ? `${gecLabel(GEC_EVENT_TYPES, next.type)} - ${next.stage}` : gecLabel(GEC_EVENT_TYPES, next.type),
          deadline: next.type === "application_deadline" ? next.startDate : null,
          eventId: next.id,
        };
      }
    }
    return {
      id: exam.id,
      slug: exam.slug,
      name: exam.name,
      recordType: exam.recordType,
      category: exam.category,
      conductingBody: exam.conductingBody,
      testkartExamName: exam.testkartExam?.name ?? null,
      isHidden: exam.isHidden ?? false,
      verification: exam.verification ?? "unverified",
      verifiedAt: exam.verifiedAt ?? null,
      reviewNote: exam.reviewNote ?? null,
      updatedAt: exam.updatedAt ?? null,
      status: gecExamStatus(exam, today),
      sections,
      keyDate,
      eventCount: exam.events.length,
      hasTbaDates: exam.events.some((event) => event.dateStatus === "tba"),
    };
  };

  const inTab = (exam: GecExam, tab: GecAdminTab) => {
    if (tab === "all") return true;
    const section = TAB_SECTIONS[tab];
    if (section) return membership.get(exam.id)?.has(section) ?? false;
    return exam.category === tab;
  };

  const tabCounts = Object.fromEntries(GEC_ADMIN_TABS.map((tab) => [tab, exams.filter((exam) => inTab(exam, tab)).length])) as Record<
    GecAdminTab,
    number
  >;

  const words = normalise(input.search ?? "").split(" ").filter(Boolean);
  const filtered = exams.filter((exam) => {
    if (!inTab(exam, input.tab)) return false;
    if (input.category && exam.category !== input.category) return false;
    if (input.verification && (exam.verification ?? "unverified") !== input.verification) return false;
    if (input.status && gecExamStatus(exam, today).status !== input.status) return false;
    if (input.month && !exam.events.some((event) => event.startDate && event.startDate.slice(0, 7) <= input.month! && (event.endDate ?? event.startDate).slice(0, 7) >= input.month!)) {
      return false;
    }
    if (input.year && !exam.events.some((event) => event.startDate?.startsWith(input.year!) || event.endDate?.startsWith(input.year!))) return false;
    if (words.length) {
      const haystack = normalise(
        [exam.name, exam.tableName, exam.shortName, exam.conductingBody, exam.keywords, exam.noticeNumber, exam.postName, exam.slug].filter(Boolean).join(" ")
      );
      if (!words.every((word) => haystack.includes(word))) return false;
    }
    return true;
  });

  const section = TAB_SECTIONS[input.tab];
  const categoryOrder = (category: GecCategory) => GEC_CATEGORIES.findIndex((item) => item.value === category);
  if (section) {
    const order = view.tableList.find((t) => t.id === section)!.rows.map((row) => row.examId);
    filtered.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  } else {
    filtered.sort((a, b) => categoryOrder(a.category) - categoryOrder(b.category) || a.sortOrder - b.sortOrder || a.id - b.id);
  }

  const total = filtered.length;
  const start = (input.page - 1) * input.limit;
  const rows = filtered.slice(start, start + input.limit).map((exam) => rowFor(exam, input.tab));

  const visible = exams.filter((exam) => !exam.isHidden);
  const stats = {
    total: exams.length,
    upcoming: visible.filter((exam) => exam.events.some((event) => GEC_STAGE.has(event.type) && event.startDate && event.startDate > today)).length,
    openApplications: view.tables.open.rows.length,
    tba: visible.filter((exam) => gecExamStatus(exam, today).status === "tba").length,
    recentlyConcluded: view.tables.concluded.rows.length,
    needsVerification: exams.filter((exam) => (exam.verification ?? "unverified") !== "verified").length,
  };

  const years = [...new Set(exams.flatMap((exam) => exam.events.flatMap((event) => [event.startDate?.slice(0, 4), event.endDate?.slice(0, 4)])))]
    .filter((year): year is string => !!year)
    .sort();

  return { rows, total, totalPages: Math.max(1, Math.ceil(total / input.limit)), tabCounts, stats, years, meta: await adminMeta() };
}

const GEC_STAGE = new Set(["prelims", "mains", "exam", "skill_test", "interview"]);

async function getExam(id: number): Promise<GecExam> {
  const snapshot = await loadSnapshot(true);
  const exam = snapshot.exams.find((item) => item.id === id);
  if (!exam) throw new GecNotFoundError("This record no longer exists");
  return exam;
}

// ---- Saving records --------------------------------------------------------

const slugify = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || "record";

async function uniqueSlug(executor: Executor, base: string, exceptId?: number) {
  let slug = base;
  for (let n = 2; n < 200; n += 1) {
    let query = executor.selectFrom("gecExams").select("id").where("slug", "=", slug);
    if (exceptId) query = query.where("id", "!=", exceptId);
    if (!(await query.executeTakeFirst())) return slug;
    slug = `${base}-${n}`;
  }
  throw new Error("Could not find a free slug");
}

const sectionFor = (category: GecCategory) => {
  const id = GEC_CATEGORY_SECTION[category];
  return id ? gecBlock(id)?.label ?? id : "Open applications";
};

/** Checks a record and returns the parsed input, or throws a GecInputError carrying field issues. */
async function checkExam(executor: Executor, raw: GecExamInput): Promise<GecExamParsed> {
  const parsed = gecExamInputSchema.safeParse(raw);
  if (!parsed.success) {
    throw new GecInputError(
      "Some fields need attention",
      parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }))
    );
  }
  const input = parsed.data;
  const issues = validateGecExam(input);
  let duplicate = executor
    .selectFrom("gecExams")
    .select(["id", "name"])
    .where(sql<boolean>`lower(name) = lower(${input.name})`)
    .where(sql<boolean>`lower(conducting_body) = lower(${input.conductingBody})`);
  if (input.id) duplicate = duplicate.where("id", "!=", input.id);
  const existing = await duplicate.executeTakeFirst();
  if (existing) issues.push({ path: "name", message: `"${existing.name}" already exists for ${input.conductingBody}. Edit that record instead.` });
  if (input.testkartExamId) {
    const linked = await executor.selectFrom("exams").select("id").where("id", "=", input.testkartExamId).executeTakeFirst();
    if (!linked) issues.push({ path: "testkartExamId", message: "That Testkart exam no longer exists" });
  }
  if (issues.length) throw new GecInputError(`${issues.length} field${issues.length === 1 ? " needs" : "s need"} attention`, issues);
  return input;
}

const describeChanges = (before: GecExam | null, after: GecExamParsed) => {
  if (!before) return `Added ${after.name} with ${after.events.length} date${after.events.length === 1 ? "" : "s"}`;
  const changes: string[] = [];
  const prev = gecExamToInput(before);
  const fields: [keyof GecExamParsed, string][] = [
    ["name", "name"],
    ["tableName", "table name"],
    ["category", "category"],
    ["conductingBody", "body"],
    ["noticeNumber", "notice number"],
    ["vacancies", "vacancies"],
    ["postName", "post"],
    ["applyUrl", "apply link"],
    ["notificationUrl", "notification link"],
    ["statusOverride", "status"],
    ["statusLabel", "status label"],
    ["isHidden", "visibility"],
    ["verification", "verification"],
  ];
  for (const [key, label] of fields) {
    if (JSON.stringify(prev[key] ?? null) !== JSON.stringify(after[key] ?? null)) changes.push(label);
  }
  if (JSON.stringify(prev.cellOverrides) !== JSON.stringify(after.cellOverrides)) changes.push("table cells");
  const prevEvents = new Map(before.events.map((event) => [event.id, event]));
  const added = after.events.filter((event) => !event.id).length;
  const removed = before.events.filter((event) => !after.events.some((next) => next.id === event.id)).length;
  const edited = after.events.filter((event) => {
    const old = event.id ? prevEvents.get(event.id) : undefined;
    return old && (old.startDate !== event.startDate || old.endDate !== event.endDate || old.dateStatus !== event.dateStatus || old.dateLabel !== event.dateLabel || old.statusOverride !== event.statusOverride);
  }).length;
  const dateParts = [edited && `${edited} changed`, added && `${added} added`, removed && `${removed} removed`].filter(Boolean);
  if (dateParts.length) changes.push(`dates (${dateParts.join(", ")})`);
  return `Updated ${after.name}${changes.length ? `: ${changes.join(", ")}` : ""}`;
};

async function saveExamWith(trx: Transaction<DB>, input: GecExamParsed, adminId: number, options: { log: boolean }) {
  const before = input.id ? (await loadSnapshot(true, trx)).exams.find((exam) => exam.id === input.id) ?? null : null;
  if (input.id && !before) throw new GecNotFoundError("This record no longer exists");

  const cellOverrides = Object.fromEntries(Object.entries(input.cellOverrides).filter(([, value]) => value.trim() !== ""));
  const verifiedNow = input.verification === "verified" && before?.verification !== "verified";
  const values = {
    recordType: input.recordType,
    category: input.category,
    name: input.name,
    tableName: input.tableName,
    shortName: input.shortName,
    conductingBody: input.conductingBody,
    testkartExamId: input.testkartExamId,
    noticeNumber: input.noticeNumber,
    postsDescription: input.postsDescription,
    vacancies: input.vacancies,
    postName: input.postName,
    officialUrl: input.officialUrl,
    notificationUrl: input.notificationUrl,
    applyUrl: input.applyUrl,
    statusOverride: input.statusOverride,
    statusLabel: input.statusLabel,
    keywords: input.keywords,
    cellOverrides: jsonbParam(cellOverrides),
    sortOrder: input.sortOrder,
    isHidden: input.isHidden,
    verification: input.verification,
    sourceNote: input.sourceNote,
    reviewNote: input.reviewNote,
    updatedAt: new Date(),
    updatedByAdminId: adminId,
    ...(verifiedNow ? { verifiedAt: new Date(), verifiedByAdminId: adminId } : {}),
    ...(input.verification !== "verified" ? { verifiedAt: null, verifiedByAdminId: null } : {}),
  };

  let id = input.id;
  if (id) {
    await trx.updateTable("gecExams").set(values).where("id", "=", id).execute();
  } else {
    const slug = await uniqueSlug(trx, slugify(input.name));
    const created = await trx
      .insertInto("gecExams")
      .values({ ...values, slug, createdByAdminId: adminId })
      .returning("id")
      .executeTakeFirstOrThrow();
    id = created.id;
  }

  const keep = input.events.filter((event) => event.id).map((event) => event.id!);
  let removal = trx.deleteFrom("gecEvents").where("gecExamId", "=", id);
  if (keep.length) removal = removal.where("id", "not in", keep);
  await removal.execute();

  for (const [index, event] of input.events.entries()) {
    const eventValues = {
      eventType: event.type,
      title: event.title,
      stage: event.stage,
      mode: event.mode,
      startDate: event.dateStatus === "tba" ? null : event.startDate,
      endDate: event.dateStatus === "tba" ? null : event.endDate,
      dateStatus: event.dateStatus,
      dateLabel: event.dateLabel,
      statusOverride: event.statusOverride,
      listingOverride: event.listingOverride,
      concludedOverride: event.concludedOverride,
      watchNext: event.watchNext,
      resultStatus: event.resultStatus,
      resultUrl: event.resultUrl,
      sourceUrl: event.sourceUrl,
      notes: event.notes,
      sortOrder: (index + 1) * 10,
      updatedAt: new Date(),
    };
    const updated = event.id
      ? await trx.updateTable("gecEvents").set(eventValues).where("id", "=", event.id).where("gecExamId", "=", id).returning("id").executeTakeFirst()
      : undefined;
    if (!updated) await trx.insertInto("gecEvents").values({ ...eventValues, gecExamId: id }).execute();
  }

  if (options.log) await logChange(trx, { adminId, section: sectionFor(input.category), summary: describeChanges(before, input) });
  return id;
}

async function saveExam(raw: GecExamInput, adminId: number) {
  const id = await db.transaction().execute(async (trx) => {
    const input = await checkExam(trx, raw);
    return saveExamWith(trx, input, adminId, { log: true });
  });
  return getExam(id);
}

async function deleteExam(id: number, adminId: number) {
  await db.transaction().execute(async (trx) => {
    const removed = await trx.deleteFrom("gecExams").where("id", "=", id).returning(["name", "category"]).executeTakeFirst();
    if (!removed) throw new GecNotFoundError("This record no longer exists");
    await logChange(trx, { adminId, section: sectionFor(removed.category), summary: `Deleted ${removed.name} and its dates` });
  });
}

async function setVerification(ids: number[], verification: GecVerification, adminId: number) {
  await db.transaction().execute(async (trx) => {
    const verified = verification === "verified";
    const rows = await trx
      .updateTable("gecExams")
      .set({
        verification,
        verifiedAt: verified ? new Date() : null,
        verifiedByAdminId: verified ? adminId : null,
        updatedAt: new Date(),
        updatedByAdminId: adminId,
      })
      .where("id", "in", ids)
      .returning("name")
      .execute();
    const label = gecLabel([{ value: "verified", label: "verified" }, { value: "unverified", label: "unverified" }, { value: "needs_update", label: "needing an update" }], verification);
    await logChange(trx, {
      adminId,
      section: "Verification",
      summary: rows.length === 1 ? `Marked ${rows[0].name} as ${label}` : `Marked ${rows.length} records as ${label}`,
    });
  });
}

async function setHidden(id: number, hidden: boolean, adminId: number) {
  await db.transaction().execute(async (trx) => {
    const row = await trx
      .updateTable("gecExams")
      .set({ isHidden: hidden, updatedAt: new Date(), updatedByAdminId: adminId })
      .where("id", "=", id)
      .returning(["name", "category"])
      .executeTakeFirst();
    if (!row) throw new GecNotFoundError("This record no longer exists");
    await logChange(trx, { adminId, section: sectionFor(row.category), summary: `${hidden ? "Hid" : "Showed"} ${row.name} ${hidden ? "from" : "on"} the public page` });
  });
}

/** A new last date for an application, marked Extended. */
async function extendDeadline(input: { eventId: number; date: string; label: string | null }, adminId: number) {
  await db.transaction().execute(async (trx) => {
    const event = await trx
      .selectFrom("gecEvents")
      .innerJoin("gecExams", "gecExams.id", "gecEvents.gecExamId")
      .select(["gecEvents.id", "gecEvents.eventType", "gecExams.name", "gecExams.category", "gecExams.id as examId"])
      .where("gecEvents.id", "=", input.eventId)
      .executeTakeFirst();
    if (!event) throw new GecNotFoundError("This date no longer exists");
    if (event.eventType !== "application_deadline") throw new GecInputError("Only an application deadline can be extended");
    await trx
      .updateTable("gecEvents")
      .set({ startDate: input.date, endDate: null, dateStatus: "confirmed", dateLabel: input.label, statusOverride: "extended", updatedAt: new Date() })
      .where("id", "=", input.eventId)
      .execute();
    await trx.updateTable("gecExams").set({ updatedAt: new Date(), updatedByAdminId: adminId }).where("id", "=", event.examId).execute();
    await logChange(trx, { adminId, section: "Open applications", summary: `Extended the last date for ${event.name} to ${gecDay(input.date)}` });
  });
}

// ---- Page content ----------------------------------------------------------

async function getContent() {
  const page = await db
    .selectFrom("gecPage")
    .leftJoin("admins", "admins.id", "gecPage.draftUpdatedByAdminId")
    .select(["gecPage.draft", "gecPage.draftUpdatedAt", "admins.fullName as draftUpdatedBy"])
    .where("gecPage.id", "=", 1)
    .executeTakeFirstOrThrow();
  return {
    page: page.draft as unknown as GecPageContent,
    draftUpdatedAt: new Date(page.draftUpdatedAt).toISOString(),
    draftUpdatedBy: page.draftUpdatedBy ?? null,
  };
}

async function saveContent(block: GecBlockKey, submitted: GecPageContent, adminId: number) {
  await db.transaction().execute(async (trx) => {
    const current = await trx.selectFrom("gecPage").select("draft").where("id", "=", 1).forUpdate().executeTakeFirstOrThrow();
    const merged = mergeGecBlock(current.draft as unknown as GecPageContent, submitted, block);
    const parsed = gecPageSchema.safeParse(merged);
    if (!parsed.success) {
      throw new GecInputError(
        "Some fields need attention",
        parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }))
      );
    }
    await trx
      .updateTable("gecPage")
      .set({ draft: jsonbParam(parsed.data), draftUpdatedAt: new Date(), draftUpdatedByAdminId: adminId })
      .where("id", "=", 1)
      .execute();
    await logChange(trx, { adminId, section: gecBlock(block)?.label ?? block, summary: `Edited ${gecBlock(block)?.label ?? block}` });
  });
  return getContent();
}

// ---- Publishing ------------------------------------------------------------

async function publish(input: { summary: string; addToPublicLog: boolean; publicText: string }, adminId: number) {
  const today = todayInIndia();
  const content = await getContent();
  if (!gecPageSchema.safeParse(content.page).success) throw new GecInputError("The page content has errors. Open Page content and fix them first.");

  await db.transaction().execute(async (trx) => {
    const publicText = input.publicText.trim();
    if (input.addToPublicLog && !publicText) throw new GecInputError("Write the update log line, or untick Add to the public update log");
    const logId = await logChange(trx, {
      adminId,
      kind: "publish",
      section: "Page",
      summary: input.addToPublicLog ? publicText : input.summary.trim() || "Published changes",
      isPublic: input.addToPublicLog,
      logDate: today,
    });
    const created = await sql<{ id: number }>`
      insert into gec_publications (snapshot, last_updated, summary, published_by_admin_id)
      select gec_build_snapshot(false), ${today}::date, ${input.summary.trim() || null}, ${adminId}
      returning id`.execute(trx);
    await trx.updateTable("gecUpdateLog").set({ publicationId: created.rows[0].id }).where("id", "=", logId).execute();
  });
  return adminMeta();
}

/** Auto log lines since the last publish, newest first: the starting point for a publish summary. */
async function pendingSummary() {
  const publication = await latestPublication();
  let query = db.selectFrom("gecUpdateLog").select(["section", "summary"]).where("kind", "in", ["auto", "manual"]).orderBy("createdAt", "desc").limit(50);
  if (publication) query = query.where("createdAt", ">", new Date(publication.publishedAt));
  return query.execute();
}

// ---- Testkart exam pages ---------------------------------------------------

const PAGE_LINKS: Record<string, { label: string; slug: string }> = {
  syllabus: { label: "Syllabus", slug: "syllabus" },
  exam_pattern: { label: "Exam pattern", slug: "exam-pattern" },
  eligibility: { label: "Eligibility", slug: "eligibility" },
  cutoff: { label: "Cutoff", slug: "cutoff" },
};

async function searchTestkartExams(q: string) {
  const term = `%${q.trim()}%`;
  return db
    .selectFrom("exams")
    .select(["id", "examName as name", "examSlug as slug", "fullName"])
    .where((eb) => eb.or([eb("examName", "ilike", term), eb("examSlug", "ilike", term), eb("fullName", "ilike", term)]))
    .orderBy(sql`length(exam_name)`)
    .limit(20)
    .execute();
}

/** Live pages of one Testkart exam, so related cards link to pages that exist instead of new ones. */
async function testkartPages(examId: number) {
  const exam = await db.selectFrom("exams").select(["id", "examName", "examSlug"]).where("id", "=", examId).executeTakeFirst();
  if (!exam) throw new GecNotFoundError("That exam no longer exists");
  const [published, custom] = await Promise.all([
    db.selectFrom("examContentPages").select("pageType").where("examId", "=", examId).where("status", "=", "published").execute(),
    db.selectFrom("examCustomPages").select(["label", "slug"]).where("examId", "=", examId).orderBy("sortOrder").execute(),
  ]);
  const types = new Set(published.map((row) => row.pageType));
  const base = `/exams/${exam.examSlug}`;
  const pages = [
    { label: `${exam.examName} overview`, href: base },
    ...Object.entries(PAGE_LINKS)
      .filter(([type]) => types.has(type))
      .map(([, page]) => ({ label: `${exam.examName} ${page.label.toLowerCase()}`, href: `${base}/${page.slug}` })),
    { label: `${exam.examName} mock tests`, href: `${base}/mock-tests` },
    { label: `${exam.examName} courses`, href: `${base}/courses` },
    { label: `${exam.examName} study notes`, href: `${base}/study-notes` },
    ...custom.filter((page) => types.has(`custom:${page.slug}`)).map((page) => ({ label: `${exam.examName} ${page.label}`, href: `${base}/${page.slug}` })),
  ];
  return { exam: { id: exam.id, name: exam.examName, slug: exam.examSlug }, pages };
}

// ---- Import and export -----------------------------------------------------

async function exportData(format: "csv" | "json") {
  const snapshot = await loadSnapshot(true);
  const content = await getContent();
  const date = todayInIndia();
  if (format === "json") {
    return {
      filename: `govt-exams-calendar-${date}.json`,
      contentType: "application/json",
      body: JSON.stringify({ format: "testkart-gec", version: 1, exportedOn: date, page: content.page, exams: snapshot.exams }, null, 2),
    };
  }
  const rows: unknown[][] = [];
  for (const exam of snapshot.exams) {
    const base = [
      exam.slug,
      exam.recordType,
      exam.category,
      exam.name,
      exam.tableName,
      exam.shortName,
      exam.conductingBody,
      exam.testkartExam?.slug ?? "",
      exam.noticeNumber,
      exam.postsDescription,
      exam.vacancies,
      exam.postName,
      exam.officialUrl,
      exam.notificationUrl,
      exam.applyUrl,
      exam.statusOverride,
      exam.statusLabel,
      exam.keywords,
      exam.isHidden ? "yes" : "no",
      exam.verification,
      exam.sourceNote,
      exam.reviewNote,
    ];
    if (exam.events.length === 0) rows.push([...base, ...Array(16).fill("")]);
    for (const event of exam.events) {
      rows.push([
        ...base,
        event.id,
        event.type,
        event.stage,
        event.mode,
        event.startDate,
        event.endDate,
        event.dateStatus,
        event.dateLabel,
        event.statusOverride,
        event.listingOverride,
        event.concludedOverride,
        event.watchNext,
        event.resultStatus,
        event.resultUrl,
        event.sourceUrl,
        event.notes,
      ]);
    }
  }
  return {
    filename: `govt-exams-calendar-${date}.csv`,
    contentType: "text/csv",
    body: gecCsvStringify([...GEC_CSV_HEADER], rows),
  };
}

type ImportRecord = { slug: string; fields: Partial<GecExamInput> & { testkartExamSlug?: string | null }; events: GecExamInput["events"] };

const nullable = (value: string | undefined) => (value === undefined ? undefined : value.trim() === "" ? null : value.trim());

function parseCsvRecords(text: string): { records: ImportRecord[]; issues: GecIssue[] } {
  const rows = gecCsvParse(text);
  const issues: GecIssue[] = [];
  if (rows.length < 2) return { records: [], issues: [{ path: "file", message: "The CSV has no data rows" }] };
  const header = rows[0].map((cell) => cell.trim().toLowerCase());
  const missing = ["exam_slug", "name", "category", "conducting_body"].filter((col) => !header.includes(col));
  if (missing.length) return { records: [], issues: [{ path: "file", message: `Missing columns: ${missing.join(", ")}` }] };
  const byslug = new Map<string, ImportRecord>();
  rows.slice(1).forEach((row, index) => {
    const get = (col: string) => {
      const at = header.indexOf(col);
      return at === -1 ? undefined : row[at] ?? "";
    };
    const slug = (get("exam_slug") ?? "").trim() || slugify(get("name") ?? "");
    if (!slug) {
      issues.push({ path: `row ${index + 2}`, message: "Row has no exam_slug or name" });
      return;
    }
    const record = byslug.get(slug) ?? { slug, fields: {}, events: [] };
    const vacancies = nullable(get("vacancies"));
    const hidden = nullable(get("hidden"));
    record.fields = {
      ...record.fields,
      ...Object.fromEntries(
        Object.entries({
          recordType: nullable(get("record_type")) as GecExamInput["recordType"] | undefined,
          category: nullable(get("category")) as GecExamInput["category"] | undefined,
          name: nullable(get("name")) ?? undefined,
          tableName: nullable(get("table_name")),
          shortName: nullable(get("short_name")),
          conductingBody: nullable(get("conducting_body")) ?? undefined,
          testkartExamSlug: nullable(get("testkart_exam_slug")),
          noticeNumber: nullable(get("notice_number")),
          postsDescription: nullable(get("posts_description")),
          vacancies: vacancies === undefined ? undefined : vacancies === null ? null : Number(vacancies.replace(/,/g, "")),
          postName: nullable(get("post_name")),
          officialUrl: nullable(get("official_url")),
          notificationUrl: nullable(get("notification_url")),
          applyUrl: nullable(get("apply_url")),
          statusOverride: nullable(get("status_override")) as GecExamInput["statusOverride"] | undefined,
          statusLabel: nullable(get("status_label")),
          keywords: nullable(get("keywords")),
          isHidden: hidden === undefined || hidden === null ? undefined : /^(yes|true|1)$/i.test(hidden),
          verification: nullable(get("verification")) as GecExamInput["verification"] | undefined,
          sourceNote: nullable(get("source_note")),
          reviewNote: nullable(get("review_note")),
        }).filter(([, value]) => value !== undefined)
      ),
    };
    const type = nullable(get("event_type"));
    if (type) {
      const eventId = nullable(get("event_id"));
      const start = nullable(get("start_date"));
      record.events.push({
        id: eventId ? Number(eventId) : undefined,
        type: type as GecExamInput["events"][number]["type"],
        title: null,
        stage: nullable(get("stage")) ?? null,
        mode: nullable(get("mode")) ?? null,
        startDate: start ?? null,
        endDate: nullable(get("end_date")) ?? null,
        dateStatus: ((nullable(get("date_status")) ?? (start ? "confirmed" : "tba")) as GecExamInput["events"][number]["dateStatus"]),
        dateLabel: nullable(get("date_label")) ?? null,
        statusOverride: (nullable(get("event_status_override")) ?? null) as GecExamInput["events"][number]["statusOverride"],
        listingOverride: (nullable(get("listing_override")) ?? "auto") as GecExamInput["events"][number]["listingOverride"],
        concludedOverride: (nullable(get("concluded_override")) ?? "auto") as GecExamInput["events"][number]["concludedOverride"],
        watchNext: nullable(get("watch_next")) ?? null,
        resultStatus: nullable(get("result_status")) ?? null,
        resultUrl: nullable(get("result_url")) ?? null,
        sourceUrl: nullable(get("source_url")) ?? null,
        notes: nullable(get("event_notes")) ?? null,
      });
    }
    byslug.set(slug, record);
  });
  return { records: [...byslug.values()], issues };
}

function parseJsonRecords(text: string): { records: ImportRecord[]; page: unknown; issues: GecIssue[] } {
  let data: { exams?: (GecExam & { testkartExam?: { slug: string } | null })[]; page?: unknown };
  try {
    data = JSON.parse(text);
  } catch {
    return { records: [], page: undefined, issues: [{ path: "file", message: "The file is not valid JSON" }] };
  }
  if (!Array.isArray(data.exams)) return { records: [], page: data.page, issues: [{ path: "file", message: "The JSON has no exams list" }] };
  const records = data.exams.map((exam) => {
    const input = gecExamToInput({ ...exam, cellOverrides: exam.cellOverrides ?? {}, events: exam.events ?? [] } as GecExam);
    const { id: _id, testkartExamId: _tk, ...fields } = input;
    return {
      slug: exam.slug || slugify(exam.name),
      fields: { ...fields, testkartExamSlug: exam.testkartExam?.slug ?? null },
      events: input.events,
    };
  });
  return { records, page: data.page, issues: [] };
}

async function importData(input: { format: "csv" | "json"; content: string; dryRun: boolean; includePage: boolean }, adminId: number) {
  const parsed = input.format === "csv" ? { ...parseCsvRecords(input.content), page: undefined } : parseJsonRecords(input.content);
  const issues: GecIssue[] = [...parsed.issues];
  const summary = { created: 0, updated: 0, eventsAdded: 0, eventsUpdated: 0, skipped: 0, pageReplaced: false };

  const run = async (trx: Transaction<DB>) => {
    const snapshot = await loadSnapshot(true, trx);
    for (const record of parsed.records) {
      const existing = snapshot.exams.find((exam) => exam.slug === record.slug);
      const { testkartExamSlug, ...fields } = record.fields;
      let testkartExamId = existing?.testkartExam?.id ?? null;
      if (testkartExamSlug !== undefined) {
        testkartExamId = testkartExamSlug
          ? (await trx.selectFrom("exams").select("id").where("examSlug", "=", testkartExamSlug).executeTakeFirst())?.id ?? null
          : null;
        if (testkartExamSlug && !testkartExamId) issues.push({ path: record.slug, message: `Testkart exam "${testkartExamSlug}" not found; link left empty` });
      }
      const baseInput: GecExamInput = existing ? gecExamToInput(existing) : { ...emptyRecord(), sortOrder: 9999 };
      const events = [...baseInput.events];
      for (const event of record.events) {
        const byId = event.id ? events.findIndex((item) => item.id === event.id) : -1;
        const byMatch =
          byId === -1
            ? events.findIndex(
                (item) =>
                  item.type === event.type &&
                  (item.stage ?? "").toLowerCase() === (event.stage ?? "").toLowerCase() &&
                  (item.startDate ?? null) === (event.startDate ?? null)
              )
            : -1;
        const at = byId !== -1 ? byId : byMatch;
        if (at !== -1) {
          events[at] = { ...events[at], ...event, id: events[at].id };
          summary.eventsUpdated += 1;
        } else {
          events.push({ ...event, id: undefined });
          summary.eventsAdded += 1;
        }
      }
      const candidate: GecExamInput = { ...baseInput, ...fields, testkartExamId, events, id: existing?.id };
      try {
        const checked = await checkExam(trx, candidate);
        if (!input.dryRun) await saveExamWith(trx, checked, adminId, { log: false });
        if (existing) summary.updated += 1;
        else summary.created += 1;
      } catch (error) {
        summary.skipped += 1;
        if (error instanceof GecInputError) {
          for (const issue of error.issues.length ? error.issues : [{ path: "", message: error.message }]) {
            issues.push({ path: `${record.slug}${issue.path ? ` ${issue.path}` : ""}`, message: issue.message });
          }
        } else {
          throw error;
        }
      }
    }
    if (input.includePage && parsed.page !== undefined) {
      const page = gecPageSchema.safeParse(parsed.page);
      if (!page.success) {
        issues.push({ path: "page", message: "The page content in the file is not valid; it was not imported" });
      } else {
        if (!input.dryRun) {
          await trx.updateTable("gecPage").set({ draft: jsonbParam(page.data), draftUpdatedAt: new Date(), draftUpdatedByAdminId: adminId }).where("id", "=", 1).execute();
        }
        summary.pageReplaced = true;
      }
    }
    if (!input.dryRun && (summary.created || summary.updated || summary.pageReplaced)) {
      await logChange(trx, {
        adminId,
        section: "Import",
        summary: `Imported ${input.format.toUpperCase()}: ${summary.created} added, ${summary.updated} updated, ${summary.eventsAdded} dates added, ${summary.eventsUpdated} dates updated${summary.pageReplaced ? ", page content replaced" : ""}`,
      });
    }
  };

  await db.transaction().execute(run);
  return { summary, issues: issues.slice(0, 200), dryRun: input.dryRun };
}

const emptyRecord = (): GecExamInput => ({
  recordType: "exam",
  category: "central",
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
  verification: "unverified",
  sourceNote: null,
  reviewNote: null,
  events: [],
});

// ---- Errors ----------------------------------------------------------------

function errorResponse(error: unknown, context: string): Response {
  if (error instanceof GecInputError) {
    return new Response(superjson.stringify({ error: error.message, issues: error.issues }), { status: 422 });
  }
  if (error instanceof GecNotFoundError) {
    return new Response(superjson.stringify({ error: error.message }), { status: 404 });
  }
  const status = error instanceof NotAuthenticatedError ? 401 : error instanceof ForbiddenError ? 403 : 400;
  if (status === 400) console.error(`${context}:`, error);
  return new Response(superjson.stringify({ error: error instanceof Error ? error.message : "Internal Server Error" }), { status });
}

export const gecServer = {
  loadPublic,
  loadDraftPayload,
  adminMeta,
  listExams,
  getExam,
  saveExam,
  deleteExam,
  setVerification,
  setHidden,
  extendDeadline,
  getContent,
  saveContent,
  publish,
  pendingSummary,
  listLog,
  addLogNote,
  deleteLogNote,
  searchTestkartExams,
  testkartPages,
  exportData,
  importData,
  errorResponse,
};
