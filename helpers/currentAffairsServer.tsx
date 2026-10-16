import superjson from "superjson";
import { sql, type Transaction } from "kysely";
import { db } from "./db";
import { ForbiddenError, NotAuthenticatedError } from "./getAdminSession";
import type { DB, CurrentAffairsStatus, CurrentAffairsTagKind } from "./schema";
import { slugify } from "./slugify";
import { sanitizeHtml } from "./sanitizeHtml";
import { currentAffairsMeta } from "./currentAffairsMeta";
import type {
  CurrentAffairsTagRef,
  InputType,
  ValidationIssue,
} from "../endpoints/admin/current-affairs/save_POST.schema";
import type { CurrentAffairsPostDetail } from "../endpoints/admin/current-affairs/get_GET.schema";

/** Raised for content problems the editor can show against a field; endpoints answer 422. */
export class CurrentAffairsInputError extends Error {
  issues: ValidationIssue[];
  constructor(message: string, issues: ValidationIssue[]) {
    super(message);
    this.name = "CurrentAffairsInputError";
    this.issues = issues;
  }
}

type Trx = Transaction<DB>;

/**
 * Scheduled posts go live by being read: every admin and public read runs this first, so a post
 * whose time has passed is published with its scheduled time as the publish time, no cron needed.
 */
async function promoteDue(): Promise<void> {
  await db
    .updateTable("currentAffairsPosts")
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

/** Blank rows are dropped; a source with only a link is named after its site. */
const sourceRows = (sources: { name: string; url: string }[]) =>
  sources
    .map((s) => ({ name: s.name.trim() || siteName(s.url.trim()), url: s.url.trim() }))
    .filter((s) => s.name || s.url);

async function findSlugOwner(
  executor: Trx | typeof db,
  slug: string,
  excludeId?: number
): Promise<{ id: number; title: string } | undefined> {
  let query = executor
    .selectFrom("currentAffairsPosts")
    .select(["id", "title"])
    .where((eb) => eb.or([eb("slug", "=", slug), sql<boolean>`previous_slugs @> ARRAY[${slug}]::text[]`]));
  if (excludeId) query = query.where("id", "!=", excludeId);
  return query.executeTakeFirst();
}

async function uniqueSlug(executor: Trx | typeof db, desired: string, excludeId?: number): Promise<string> {
  const base = slugify(desired) || "current-affairs";
  let candidate = base;
  for (let n = 2; await findSlugOwner(executor, candidate, excludeId); n++) {
    candidate = `${base}-${n}`;
  }
  return candidate;
}

/** Resolves chips to tag ids, creating custom tags by kind + slug so the same name is never stored twice. */
async function resolveTags(trx: Trx, refs: CurrentAffairsTagRef[], adminId: number): Promise<Map<string, number>> {
  const keyOf = (kind: CurrentAffairsTagKind, name: string) => `${kind}:${slugify(name)}`;
  const wanted = new Map<string, { kind: CurrentAffairsTagKind; name: string; slug: string }>();
  for (const ref of refs) {
    const slug = slugify(ref.name);
    if (!slug) continue;
    wanted.set(keyOf(ref.kind, ref.name), { kind: ref.kind, name: ref.name.trim(), slug });
  }
  const resolved = new Map<string, number>();
  if (wanted.size === 0) return resolved;

  await trx
    .insertInto("currentAffairsTags")
    .values([...wanted.values()].map((t) => ({ ...t, createdBy: adminId })))
    .onConflict((oc) => oc.columns(["kind", "slug"]).doNothing())
    .execute();

  const rows = await trx
    .selectFrom("currentAffairsTags")
    .select(["id", "kind", "slug"])
    .where((eb) =>
      eb.or([...wanted.values()].map((t) => eb.and([eb("kind", "=", t.kind), eb("slug", "=", t.slug)])))
    )
    .execute();
  for (const row of rows) resolved.set(`${row.kind}:${row.slug}`, row.id);
  return resolved;
}

const tagKey = (ref: CurrentAffairsTagRef) => `${ref.kind}:${slugify(ref.name)}`;

function uniqueAnchors(headlines: string[]): string[] {
  const used = new Set<string>();
  return headlines.map((headline, index) => {
    const base = slugify(headline).slice(0, 80) || `item-${index + 1}`;
    let anchor = base;
    for (let n = 2; used.has(anchor); n++) anchor = `${base}-${n}`;
    used.add(anchor);
    return anchor;
  });
}

function computeReadingTime(input: InputType): number {
  if (input.readingTimeIsManual) return input.readingTimeMinutes;
  return currentAffairsMeta.readingMinutes([
    input.summary,
    input.body,
    ...input.atAGlance,
    ...input.items.flatMap((item) => [item.headline, item.whyInNews, item.keyPoints, item.background]),
  ]);
}

type ExistingState = {
  status: CurrentAffairsStatus;
  slug: string;
  previousSlugs: string[];
  publishedAt: Date | null;
  firstPublishedAt: Date | null;
};

/** Status and timestamps for a save, so publish times stay put across later edits. */
function publicationFields(input: InputType, existing: ExistingState | undefined, now: Date) {
  const publishAt = input.publishAt ? currentAffairsMeta.fromIstInput(input.publishAt) : null;

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
  // Saving a draft leaves an archived post archived; only publishing or Restore brings it back.
  return {
    status: existing?.status === "archived" ? ("archived" as const) : ("draft" as const),
    publishAt,
    publishedAt: null,
  };
}

/**
 * Writes the whole aggregate. Child rows (items, sources, tag links, quiz, related, corrections)
 * are replaced rather than diffed: the editor always sends the full document.
 */
async function save(input: InputType, adminId: number, options: { autoSlug?: boolean } = {}): Promise<number> {
  const now = new Date();

  return db.transaction().execute(async (trx) => {
    const existing = input.id
      ? await trx
          .selectFrom("currentAffairsPosts")
          .select(["id", "status", "slug", "previousSlugs", "publishedAt", "firstPublishedAt"])
          .where("id", "=", input.id)
          .forUpdate()
          .executeTakeFirst()
      : undefined;
    if (input.id && !existing) throw new Error("Current affairs post not found");

    const issues: ValidationIssue[] = [];
    const digestDate = input.digestDate ? currentAffairsMeta.periodStart(input.contentType, input.digestDate) : "";
    let slug = slugify(input.slug || input.title);
    if (!slug) issues.push({ path: "slug", message: "Add a slug" });
    if (slug && options.autoSlug) {
      slug = await uniqueSlug(trx, slug, existing?.id);
    } else if (slug) {
      const owner = await findSlugOwner(trx, slug, existing?.id);
      if (owner) issues.push({ path: "slug", message: `Already used by "${owner.title}"` });
    }

    // One live digest per type, language and period.
    if (currentAffairsMeta.isDigest(input.contentType) && digestDate && input.status !== "draft") {
      let clash = trx
        .selectFrom("currentAffairsPosts")
        .select(["id", "title"])
        .where("contentType", "=", input.contentType)
        .where("language", "=", input.language)
        .where(sql<boolean>`digest_date = ${digestDate}::date`)
        .where("status", "in", ["scheduled", "published"]);
      if (existing) clash = clash.where("id", "!=", existing.id);
      const other = await clash.executeTakeFirst();
      if (other) {
        issues.push({
          path: "digestDate",
          message: `"${other.title}" is already the ${currentAffairsMeta.languageLabel(input.language)} ${currentAffairsMeta
            .contentTypeShort(input.contentType)
            .toLowerCase()} digest for this period`,
        });
      }
    }

    if (input.authorId) {
      const author = await trx.selectFrom("admins").select("id").where("id", "=", input.authorId).executeTakeFirst();
      if (!author) issues.push({ path: "authorId", message: "That author no longer exists" });
    }

    if (issues.length > 0) throw new CurrentAffairsInputError("Some fields need attention", issues);

    const previousSlugs =
      existing && existing.slug !== slug && existing.firstPublishedAt
        ? Array.from(new Set([...existing.previousSlugs, existing.slug])).filter((s) => s !== slug)
        : existing?.previousSlugs.filter((s) => s !== slug) ?? [];

    const values = {
      contentType: input.contentType,
      title: input.title.trim(),
      slug,
      previousSlugs,
      summary: input.summary.trim() || null,
      coverImageUrl: input.coverImageUrl || null,
      coverImageFileId: input.coverImageFileId || null,
      coverImageAlt: input.coverImageAlt.trim() || null,
      coverImageCredit: input.coverImageCredit.trim() || null,
      authorId: input.authorId,
      language: input.language,
      digestDate: digestDate || null,
      glancePoints: input.atAGlance.map((line) => line.trim()).filter(Boolean),
      body: sanitizeHtml(input.body),
      readingTimeMinutes: computeReadingTime(input),
      readingTimeIsManual: input.readingTimeIsManual,
      seoTitle: input.seoTitle.trim() || null,
      seoDescription: input.seoDescription.trim() || null,
      ogImageUrl: input.ogImageUrl || null,
      ogImageFileId: input.ogImageFileId || null,
      updatedBy: adminId,
      updatedAt: now,
      ...publicationFields(input, existing, now),
    };

    let postId: number;
    if (existing) {
      postId = existing.id;
      await trx.updateTable("currentAffairsPosts").set(values).where("id", "=", postId).execute();
      await trx.deleteFrom("currentAffairsTagLinks").where("postId", "=", postId).execute();
      await trx.deleteFrom("currentAffairsSources").where("postId", "=", postId).execute();
      await trx.deleteFrom("currentAffairsItems").where("postId", "=", postId).execute();
      await trx.deleteFrom("currentAffairsQuizzes").where("postId", "=", postId).execute();
      await trx.deleteFrom("currentAffairsRelated").where("postId", "=", postId).execute();
      await trx.deleteFrom("currentAffairsCorrections").where("postId", "=", postId).execute();
    } else {
      const created = await trx
        .insertInto("currentAffairsPosts")
        .values({ ...values, createdBy: adminId })
        .returning("id")
        .executeTakeFirstOrThrow();
      postId = created.id;
    }

    const allRefs = [
      ...input.tags,
      ...input.items.flatMap((item) => item.tags),
      ...(input.quiz?.questions.flatMap((q) => q.tags) ?? []),
    ];
    const tagIds = await resolveTags(trx, allRefs, adminId);
    const links: { tagId: number; postId: number; itemId: number | null; questionId: number | null }[] = [];
    const pushLinks = (refs: CurrentAffairsTagRef[], itemId: number | null, questionId: number | null) => {
      const seen = new Set<number>();
      for (const ref of refs) {
        const tagId = tagIds.get(tagKey(ref));
        if (!tagId || seen.has(tagId)) continue;
        seen.add(tagId);
        links.push({ tagId, postId, itemId, questionId });
      }
    };
    pushLinks(input.tags, null, null);

    const postSources = sourceRows(input.sources);
    if (postSources.length > 0) {
      await trx
        .insertInto("currentAffairsSources")
        .values(postSources.map((s, position) => ({ ...s, postId, itemId: null, position })))
        .execute();
    }

    if (input.items.length > 0) {
      const anchors = uniqueAnchors(input.items.map((item) => item.headline));
      const itemRows = await trx
        .insertInto("currentAffairsItems")
        .values(
          input.items.map((item, position) => ({
            postId,
            position,
            headline: item.headline.trim(),
            anchorSlug: anchors[position],
            whyInNews: item.whyInNews.trim(),
            keyPoints: sanitizeHtml(item.keyPoints),
            background: sanitizeHtml(item.background),
            imageUrl: item.imageUrl || null,
            imageFileId: item.imageFileId || null,
            imageAlt: item.imageAlt.trim() || null,
            imageCredit: item.imageCredit.trim() || null,
          }))
        )
        .returning(["id", "position"])
        .execute();
      itemRows.sort((a, b) => a.position - b.position);

      const itemSources = input.items.flatMap((item, index) =>
        sourceRows(item.sources).map((s, position) => ({ ...s, postId, itemId: itemRows[index].id, position }))
      );
      if (itemSources.length > 0) await trx.insertInto("currentAffairsSources").values(itemSources).execute();
      input.items.forEach((item, index) => pushLinks(item.tags, itemRows[index].id, null));
    }

    if (input.quiz) {
      const quiz = await trx
        .insertInto("currentAffairsQuizzes")
        .values({
          postId,
          title: input.quiz.title.trim(),
          questionCount: input.quiz.questionCount,
          isPublished: input.quiz.isPublished,
        })
        .returning("id")
        .executeTakeFirstOrThrow();
      if (input.quiz.questions.length > 0) {
        const questionRows = await trx
          .insertInto("currentAffairsQuizQuestions")
          .values(
            input.quiz.questions.map((q, position) => ({
              quizId: quiz.id,
              position,
              question: q.question.trim(),
              options: q.options.map((o) => o.trim()),
              correctOption: q.correctOption,
              explanation: q.explanation.trim(),
            }))
          )
          .returning(["id", "position"])
          .execute();
        questionRows.sort((a, b) => a.position - b.position);
        input.quiz.questions.forEach((q, index) => pushLinks(q.tags, null, questionRows[index].id));
      }
    }

    if (links.length > 0) await trx.insertInto("currentAffairsTagLinks").values(links).execute();

    const relatedIds = [...new Set(input.relatedIds)].filter((id) => id !== postId);
    if (relatedIds.length > 0) {
      const found = await trx.selectFrom("currentAffairsPosts").select("id").where("id", "in", relatedIds).execute();
      const valid = new Set(found.map((r) => r.id));
      const rows = relatedIds
        .filter((id) => valid.has(id))
        .map((relatedPostId, position) => ({ postId, relatedPostId, position }));
      if (rows.length > 0) await trx.insertInto("currentAffairsRelated").values(rows).execute();
    }

    const corrections = input.corrections.filter((c) => c.date && c.note.trim());
    if (corrections.length > 0) {
      await trx
        .insertInto("currentAffairsCorrections")
        .values(corrections.map((c, position) => ({ postId, correctedOn: c.date, note: c.note.trim(), position })))
        .execute();
    }

    return postId;
  });
}

async function loadDetail(id: number): Promise<CurrentAffairsPostDetail | null> {
  const post = await db
    .selectFrom("currentAffairsPosts as p")
    .leftJoin("admins as author", "author.id", "p.authorId")
    .leftJoin("admins as creator", "creator.id", "p.createdBy")
    .leftJoin("admins as editor", "editor.id", "p.updatedBy")
    .selectAll("p")
    .select([
      "author.fullName as authorName",
      "creator.fullName as createdByName",
      "editor.fullName as updatedByName",
      sql<string | null>`to_char(p.digest_date, 'YYYY-MM-DD')`.as("digestDay"),
    ])
    .where("p.id", "=", id)
    .executeTakeFirst();
  if (!post) return null;

  const [items, sources, tagRows, quiz, related, corrections] = await Promise.all([
    db.selectFrom("currentAffairsItems").selectAll().where("postId", "=", id).orderBy("position").execute(),
    db.selectFrom("currentAffairsSources").selectAll().where("postId", "=", id).orderBy("position").execute(),
    db
      .selectFrom("currentAffairsTagLinks as l")
      .innerJoin("currentAffairsTags as t", "t.id", "l.tagId")
      .select(["l.itemId", "l.questionId", "t.id", "t.kind", "t.name", "t.sortOrder"])
      .where("l.postId", "=", id)
      .orderBy("l.id")
      .execute(),
    db.selectFrom("currentAffairsQuizzes").selectAll().where("postId", "=", id).executeTakeFirst(),
    db
      .selectFrom("currentAffairsRelated as r")
      .innerJoin("currentAffairsPosts as rp", "rp.id", "r.relatedPostId")
      .select(["rp.id", "rp.title", "rp.slug", "rp.contentType", "rp.status"])
      .where("r.postId", "=", id)
      .orderBy("r.position")
      .execute(),
    db
      .selectFrom("currentAffairsCorrections")
      .select(["id", "note", sql<string>`to_char(corrected_on, 'YYYY-MM-DD')`.as("day")])
      .where("postId", "=", id)
      .orderBy("position")
      .execute(),
  ]);

  const questions = quiz
    ? await db
        .selectFrom("currentAffairsQuizQuestions")
        .selectAll()
        .where("quizId", "=", quiz.id)
        .orderBy("position")
        .execute()
    : [];

  const tagsWhere = (match: (row: (typeof tagRows)[number]) => boolean): CurrentAffairsTagRef[] =>
    tagRows.filter(match).map((row) => ({ id: row.id, kind: row.kind, name: row.name }));

  return {
    id: post.id,
    contentType: post.contentType,
    title: post.title,
    slug: post.slug,
    summary: post.summary ?? "",
    coverImageUrl: post.coverImageUrl ?? "",
    coverImageFileId: post.coverImageFileId ?? "",
    coverImageAlt: post.coverImageAlt ?? "",
    coverImageCredit: post.coverImageCredit ?? "",
    authorId: post.authorId,
    language: post.language,
    status: post.status,
    publishAt: currentAffairsMeta.toIstInput(post.publishAt),
    digestDate: post.digestDay ?? "",
    atAGlance: post.glancePoints,
    body: post.body,
    readingTimeMinutes: post.readingTimeMinutes,
    readingTimeIsManual: post.readingTimeIsManual,
    seoTitle: post.seoTitle ?? "",
    seoDescription: post.seoDescription ?? "",
    ogImageUrl: post.ogImageUrl ?? "",
    ogImageFileId: post.ogImageFileId ?? "",
    tags: tagsWhere((row) => row.itemId === null && row.questionId === null),
    sources: sources.filter((s) => s.itemId === null).map((s) => ({ name: s.name, url: s.url })),
    items: items.map((item) => ({
      key: `item-${item.id}`,
      headline: item.headline,
      whyInNews: item.whyInNews,
      keyPoints: item.keyPoints,
      background: item.background,
      imageUrl: item.imageUrl ?? "",
      imageFileId: item.imageFileId ?? "",
      imageAlt: item.imageAlt ?? "",
      imageCredit: item.imageCredit ?? "",
      tags: tagsWhere((row) => row.itemId === item.id),
      sources: sources.filter((s) => s.itemId === item.id).map((s) => ({ name: s.name, url: s.url })),
    })),
    relatedIds: related.map((r) => r.id),
    related,
    corrections: corrections.map((c) => ({ key: `correction-${c.id}`, date: c.day, note: c.note })),
    quiz: quiz
      ? {
          title: quiz.title,
          questionCount: quiz.questionCount,
          isPublished: quiz.isPublished,
          questions: questions.map((q) => ({
            key: `question-${q.id}`,
            question: q.question,
            options: q.options,
            correctOption: q.correctOption,
            explanation: q.explanation,
            tags: tagsWhere((row) => row.questionId === q.id),
          })),
        }
      : null,
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

/** A loaded post back in save shape, for actions that re-save or re-validate it. */
function detailToInput(detail: CurrentAffairsPostDetail, status: InputType["status"]): InputType {
  return {
    id: detail.id,
    contentType: detail.contentType,
    title: detail.title,
    slug: detail.slug,
    summary: detail.summary,
    coverImageUrl: detail.coverImageUrl,
    coverImageFileId: detail.coverImageFileId,
    coverImageAlt: detail.coverImageAlt,
    coverImageCredit: detail.coverImageCredit,
    authorId: detail.authorId,
    language: detail.language,
    status,
    publishAt: detail.publishAt,
    digestDate: detail.digestDate,
    atAGlance: detail.atAGlance,
    body: detail.body,
    readingTimeMinutes: detail.readingTimeMinutes,
    readingTimeIsManual: detail.readingTimeIsManual,
    seoTitle: detail.seoTitle,
    seoDescription: detail.seoDescription,
    ogImageUrl: detail.ogImageUrl,
    ogImageFileId: detail.ogImageFileId,
    tags: detail.tags,
    sources: detail.sources,
    items: detail.items,
    relatedIds: detail.relatedIds,
    corrections: detail.corrections,
    quiz: detail.quiz,
  };
}

/** The JSON error every current affairs endpoint answers with. */
function errorResponse(error: unknown, context: string): Response {
  if (error instanceof CurrentAffairsInputError) {
    return new Response(superjson.stringify({ error: error.message, issues: error.issues }), { status: 422 });
  }
  const status = error instanceof NotAuthenticatedError ? 401 : error instanceof ForbiddenError ? 403 : 400;
  if (status === 400) console.error(`${context}:`, error);
  return new Response(
    superjson.stringify({ error: error instanceof Error ? error.message : "Internal Server Error" }),
    { status }
  );
}

export const currentAffairsServer = {
  promoteDue,
  save,
  loadDetail,
  detailToInput,
  findSlugOwner,
  uniqueSlug,
  errorResponse,
};