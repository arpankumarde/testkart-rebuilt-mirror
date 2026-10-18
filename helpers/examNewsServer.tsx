import superjson from "superjson";
import { sql, type Transaction } from "kysely";
import { db } from "./db";
import { ForbiddenError, NotAuthenticatedError } from "./getAdminSession";
import type { DB, ExamNewsStatus } from "./schema";
import { slugify } from "./slugify";
import { sanitizeHtml } from "./sanitizeHtml";
import { examNewsMeta } from "./examNewsMeta";
import { RESERVED_SLUGS } from "./examNewsPublicMeta";
import type { InputType, ValidationIssue } from "../endpoints/admin/exam-news/save_POST.schema";
import type { ExamNewsDetail } from "../endpoints/admin/exam-news/get_GET.schema";

/** Raised for content problems the editor can show against a field; endpoints answer 422. */
export class ExamNewsInputError extends Error {
  issues: ValidationIssue[];
  constructor(message: string, issues: ValidationIssue[]) {
    super(message);
    this.name = "ExamNewsInputError";
    this.issues = issues;
  }
}

type Trx = Transaction<DB>;

/** Scheduled stories go live by being read, as Current Affairs posts do: no cron needed. */
async function promoteDue(): Promise<void> {
  await db
    .updateTable("examNewsPosts")
    .set({
      status: "published",
      publishedAt: sql`publish_at`,
      firstPublishedAt: sql`coalesce(first_published_at, publish_at)`,
    })
    .where("status", "=", "scheduled")
    .where("publishAt", "<=", new Date())
    .execute();
}

const siteName = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

async function findSlugOwner(
  executor: Trx | typeof db,
  slug: string,
  excludeId?: number
): Promise<{ id: number; title: string } | undefined> {
  let query = executor
    .selectFrom("examNewsPosts")
    .select(["id", "title"])
    .where((eb) => eb.or([eb("slug", "=", slug), sql<boolean>`previous_slugs @> ARRAY[${slug}]::text[]`]));
  if (excludeId) query = query.where("id", "!=", excludeId);
  return query.executeTakeFirst();
}

type ExistingState = {
  status: ExamNewsStatus;
  slug: string;
  previousSlugs: string[];
  publishedAt: Date | null;
  firstPublishedAt: Date | null;
};

/** Status and timestamps for a save, so publish times stay put across later edits. */
function publicationFields(input: InputType, existing: ExistingState | undefined, now: Date) {
  const publishAt = input.publishAt ? examNewsMeta.fromIstInput(input.publishAt) : null;

  if (input.status === "published") {
    const keepTime = existing?.status === "published" && existing.publishedAt && !input.publishAt;
    const at = keepTime ? existing!.publishedAt! : publishAt ?? now;
    return {
      status: "published" as const,
      publishAt: at,
      publishedAt: at,
      firstPublishedAt: existing?.firstPublishedAt ?? at,
      archivedAt: null,
    };
  }
  if (input.status === "scheduled") {
    return { status: "scheduled" as const, publishAt, publishedAt: null, archivedAt: null };
  }
  // Saving a draft leaves an archived story archived; only publishing or Restore brings it back.
  return {
    status: existing?.status === "archived" ? ("archived" as const) : ("draft" as const),
    publishAt,
    publishedAt: null,
  };
}

const orNull = (value: string) => value.trim() || null;

/** Writes the whole story. Key dates, sources and corrections are replaced, not diffed. */
async function save(input: InputType, adminId: number): Promise<number> {
  const now = new Date();

  return db.transaction().execute(async (trx) => {
    const existing = input.id
      ? await trx
          .selectFrom("examNewsPosts")
          .select(["id", "status", "slug", "previousSlugs", "publishedAt", "firstPublishedAt"])
          .where("id", "=", input.id)
          .forUpdate()
          .executeTakeFirst()
      : undefined;
    if (input.id && !existing) throw new Error("News story not found");

    const issues: ValidationIssue[] = [];
    const slug = slugify(input.slug || input.title);
    if (!slug) issues.push({ path: "slug", message: "Add a slug" });
    else if ((RESERVED_SLUGS as readonly string[]).includes(slug)) {
      issues.push({ path: "slug", message: `"${slug}" is part of the Exam News URLs - choose another slug` });
    } else {
      const owner = await findSlugOwner(trx, slug, existing?.id);
      if (owner) issues.push({ path: "slug", message: `Already used by "${owner.title}"` });
    }
    if (input.authorId) {
      const author = await trx.selectFrom("admins").select("id").where("id", "=", input.authorId).executeTakeFirst();
      if (!author) issues.push({ path: "authorId", message: "That author no longer exists" });
    }
    if (input.examId) {
      const exam = await trx.selectFrom("exams").select("id").where("id", "=", input.examId).executeTakeFirst();
      if (!exam) issues.push({ path: "examId", message: "That exam no longer exists" });
    }
    if (issues.length > 0) throw new ExamNewsInputError("Some fields need attention", issues);

    const previousSlugs =
      existing && existing.slug !== slug && existing.firstPublishedAt
        ? Array.from(new Set([...existing.previousSlugs, existing.slug])).filter((s) => s !== slug)
        : existing?.previousSlugs.filter((s) => s !== slug) ?? [];

    const officialUrl = input.officialSourceUrl.trim();
    const values = {
      title: input.title.trim(),
      slug,
      previousSlugs,
      summary: orNull(input.summary),
      newsType: input.newsType,
      examId: input.examId,
      authorId: input.authorId,
      body: sanitizeHtml(input.body),
      heroImageUrl: input.heroImageUrl || null,
      heroImageFileId: input.heroImageFileId || null,
      heroImageAlt: orNull(input.heroImageAlt),
      heroImageCredit: orNull(input.heroImageCredit),
      officialSourceName: officialUrl ? input.officialSourceName.trim() || siteName(officialUrl) || null : null,
      officialSourceUrl: officialUrl || null,
      seoTitle: orNull(input.seoTitle),
      seoDescription: orNull(input.seoDescription),
      ogTitle: orNull(input.ogTitle),
      ogDescription: orNull(input.ogDescription),
      ogImageUrl: input.ogImageUrl || null,
      ogImageFileId: input.ogImageFileId || null,
      canonicalUrl: orNull(input.canonicalUrl),
      updatedBy: adminId,
      updatedAt: now,
      ...publicationFields(input, existing, now),
    };

    let postId: number;
    if (existing) {
      postId = existing.id;
      await trx.updateTable("examNewsPosts").set(values).where("id", "=", postId).execute();
      await trx.deleteFrom("examNewsKeyDates").where("postId", "=", postId).execute();
      await trx.deleteFrom("examNewsSources").where("postId", "=", postId).execute();
      await trx.deleteFrom("examNewsCorrections").where("postId", "=", postId).execute();
    } else {
      const created = await trx
        .insertInto("examNewsPosts")
        .values({ ...values, createdBy: adminId })
        .returning("id")
        .executeTakeFirstOrThrow();
      postId = created.id;
    }

    const keyDates = input.keyDates.filter(
      (row) => row.eventName.trim() || row.startDate || row.endDate || row.examDate || row.resultDate || row.note.trim()
    );
    if (keyDates.length > 0) {
      await trx
        .insertInto("examNewsKeyDates")
        .values(
          keyDates.map((row, position) => ({
            postId,
            position,
            eventName: row.eventName.trim(),
            startDate: row.startDate || null,
            endDate: row.endDate || null,
            examDate: row.examDate || null,
            resultDate: row.resultDate || null,
            note: orNull(row.note),
          }))
        )
        .execute();
    }

    const sources = input.sources
      .map((s) => ({ name: s.name.trim() || siteName(s.url.trim()), url: s.url.trim() }))
      .filter((s) => s.url);
    if (sources.length > 0) {
      await trx
        .insertInto("examNewsSources")
        .values(sources.map((s, position) => ({ ...s, postId, position })))
        .execute();
    }

    const corrections = input.corrections.filter((c) => c.date && c.note.trim());
    if (corrections.length > 0) {
      await trx
        .insertInto("examNewsCorrections")
        .values(corrections.map((c, position) => ({ postId, correctedOn: c.date, note: c.note.trim(), position })))
        .execute();
    }

    return postId;
  });
}

const day = (column: string) => sql<string | null>`to_char(${sql.ref(column)}, 'YYYY-MM-DD')`;

async function loadDetail(id: number): Promise<ExamNewsDetail | null> {
  const post = await db
    .selectFrom("examNewsPosts as p")
    .leftJoin("exams as e", "e.id", "p.examId")
    .leftJoin("admins as author", "author.id", "p.authorId")
    .leftJoin("admins as creator", "creator.id", "p.createdBy")
    .leftJoin("admins as editor", "editor.id", "p.updatedBy")
    .selectAll("p")
    .select([
      "e.examName as examName",
      "e.examSlug as examSlug",
      "author.fullName as authorName",
      "creator.fullName as createdByName",
      "editor.fullName as updatedByName",
    ])
    .where("p.id", "=", id)
    .executeTakeFirst();
  if (!post) return null;

  const [keyDates, sources, corrections] = await Promise.all([
    db
      .selectFrom("examNewsKeyDates")
      .select([
        "id",
        "eventName",
        "note",
        day("start_date").as("startDay"),
        day("end_date").as("endDay"),
        day("exam_date").as("examDay"),
        day("result_date").as("resultDay"),
      ])
      .where("postId", "=", id)
      .orderBy("position")
      .execute(),
    db.selectFrom("examNewsSources").select(["name", "url"]).where("postId", "=", id).orderBy("position").execute(),
    db
      .selectFrom("examNewsCorrections")
      .select(["id", "note", day("corrected_on").as("correctedDay")])
      .where("postId", "=", id)
      .orderBy("position")
      .execute(),
  ]);

  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    summary: post.summary ?? "",
    newsType: post.newsType,
    examId: post.examId,
    authorId: post.authorId,
    status: post.status,
    publishAt: examNewsMeta.toIstInput(post.publishAt),
    body: post.body,
    heroImageUrl: post.heroImageUrl ?? "",
    heroImageFileId: post.heroImageFileId ?? "",
    heroImageAlt: post.heroImageAlt ?? "",
    heroImageCredit: post.heroImageCredit ?? "",
    keyDates: keyDates.map((row) => ({
      key: `date-${row.id}`,
      eventName: row.eventName,
      startDate: row.startDay ?? "",
      endDate: row.endDay ?? "",
      examDate: row.examDay ?? "",
      resultDate: row.resultDay ?? "",
      note: row.note ?? "",
    })),
    officialSourceName: post.officialSourceName ?? "",
    officialSourceUrl: post.officialSourceUrl ?? "",
    sources,
    corrections: corrections.map((c) => ({ key: `correction-${c.id}`, date: c.correctedDay ?? "", note: c.note })),
    seoTitle: post.seoTitle ?? "",
    seoDescription: post.seoDescription ?? "",
    ogTitle: post.ogTitle ?? "",
    ogDescription: post.ogDescription ?? "",
    ogImageUrl: post.ogImageUrl ?? "",
    ogImageFileId: post.ogImageFileId ?? "",
    canonicalUrl: post.canonicalUrl ?? "",
    examName: post.examName,
    examSlug: post.examSlug,
    previousSlugs: post.previousSlugs,
    publishedAt: post.publishedAt,
    firstPublishedAt: post.firstPublishedAt,
    archivedAt: post.archivedAt,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    authorName: post.authorName,
    createdByName: post.createdByName,
    updatedByName: post.updatedByName,
  };
}

/** A loaded story back in save shape, for actions that re-save or re-validate it. */
function detailToInput(detail: ExamNewsDetail, status: InputType["status"]): InputType {
  const {
    status: _status,
    examName: _examName,
    examSlug: _examSlug,
    previousSlugs: _previousSlugs,
    publishedAt: _publishedAt,
    firstPublishedAt: _firstPublishedAt,
    archivedAt: _archivedAt,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    authorName: _authorName,
    createdByName: _createdByName,
    updatedByName: _updatedByName,
    ...input
  } = detail;
  return { ...input, status };
}

/** The JSON error every exam news endpoint answers with. */
function errorResponse(error: unknown, context: string): Response {
  if (error instanceof ExamNewsInputError) {
    return new Response(superjson.stringify({ error: error.message, issues: error.issues }), { status: 422 });
  }
  const status = error instanceof NotAuthenticatedError ? 401 : error instanceof ForbiddenError ? 403 : 400;
  if (status === 400) console.error(`${context}:`, error);
  return new Response(
    superjson.stringify({ error: error instanceof Error ? error.message : "Internal Server Error" }),
    { status }
  );
}

export const examNewsServer = {
  promoteDue,
  save,
  loadDetail,
  detailToInput,
  findSlugOwner,
  errorResponse,
};