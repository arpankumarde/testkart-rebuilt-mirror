import { sql } from "kysely";
import { db } from "./db";
import { currentAffairsServer } from "./currentAffairsServer";
import { currentAffairsMeta, type ArchiveType } from "./currentAffairsMeta";
import type { CurrentAffairsContentType, CurrentAffairsLanguage } from "./schema";
import type { OutputType as HubOutput, PublicDigestCard } from "../endpoints/current-affairs/hub_GET.schema";
import type { InputType as ListInput, OutputType as ListOutput, PublicListType } from "../endpoints/current-affairs/list_GET.schema";
import type { PublicDigestDetail } from "../endpoints/current-affairs/details_GET.schema";
import type { InputType as StoriesInput, OutputType as StoriesOutput } from "../endpoints/current-affairs/stories_GET.schema";

/*
 * Public reads for the Current Affairs pages, shared by the /_api/current-affairs/* endpoints and
 * the SSR prefetches (a prefetch cannot call the app's own endpoints). Every query is limited to
 * status "published"; drafts, scheduled and archived posts never leave the server here.
 */

const PAGE_SIZE = 12;
const STORY_PAGE_SIZE = 15;
const STORY_SUMMARY_CHARS = 220;
const DAILY_LIST = 7;
const LATEST_LIST = 10;
const EDITORIALS = 3;

const TYPE_FILTERS: Record<Exclude<PublicListType, "quiz">, CurrentAffairsContentType> = {
  daily: "daily_digest",
  editorials: "editorial_analysis",
  weekly: "weekly_digest",
  monthly: "monthly_digest",
};

type Filters = {
  contentType?: CurrentAffairsContentType;
  withQuiz?: boolean;
  topicSlug?: string;
  examSlug?: string;
  language?: CurrentAffairsLanguage;
};

function cardQuery(filters: Filters) {
  let query = db
    .selectFrom("currentAffairsPosts as p")
    .leftJoin("admins as a", "a.id", "p.authorId")
    .leftJoin("currentAffairsQuizzes as q", (join) => join.onRef("q.postId", "=", "p.id").on("q.isPublished", "=", true))
    .where("p.status", "=", "published");
  if (filters.contentType) query = query.where("p.contentType", "=", filters.contentType);
  if (filters.language) query = query.where("p.language", "=", filters.language);
  if (filters.withQuiz) query = query.where("q.id", "is not", null);
  for (const [kind, slug] of [
    ["topic", filters.topicSlug],
    ["exam", filters.examSlug],
  ] as const) {
    if (!slug) continue;
    query = query.where((eb) =>
      eb.exists(
        eb
          .selectFrom("currentAffairsTagLinks as l")
          .innerJoin("currentAffairsTags as t", "t.id", "l.tagId")
          .select("l.id")
          .whereRef("l.postId", "=", "p.id")
          .where("t.kind", "=", kind)
          .where("t.slug", "=", slug)
      )
    );
  }
  return query;
}

async function selectCards(filters: Filters, limit: number, offset = 0): Promise<PublicDigestCard[]> {
  const rows = await cardQuery(filters)
    .select([
      "p.id",
      "p.title",
      "p.slug",
      "p.contentType",
      "p.language",
      "p.summary",
      "p.coverImageUrl",
      "p.coverImageAlt",
      "p.publishedAt",
      "p.readingTimeMinutes",
      "a.fullName as authorName",
      "q.questionCount as quizQuestionCount",
      sql<string | null>`to_char(p.digest_date, 'YYYY-MM-DD')`.as("digestDate"),
      sql<number>`(select count(*)::int from current_affairs_items i where i.post_id = p.id)`.as("itemCount"),
      sql<string | null>`coalesce(
        nullif(p.cover_image_url, ''),
        nullif(p.og_image_url, ''),
        (select i.image_url from current_affairs_items i
          where i.post_id = p.id and coalesce(i.image_url, '') <> ''
          order by i.position, i.id limit 1)
      )`.as("thumbnailUrl"),
    ])
    // Newest period first; posts without a period sort by publish time.
    .orderBy(sql`coalesce(p.digest_date, (p.published_at at time zone 'Asia/Kolkata')::date)`, "desc")
    .orderBy("p.publishedAt", "desc")
    .orderBy("p.id", "desc")
    .limit(limit)
    .offset(offset)
    .execute();

  if (rows.length === 0) return [];
  const tags = await db
    .selectFrom("currentAffairsTagLinks as l")
    .innerJoin("currentAffairsTags as t", "t.id", "l.tagId")
    .select(["l.postId", "t.kind", "t.name", "t.slug", "t.examId", "t.sortOrder"])
    .distinct()
    .where("l.postId", "in", rows.map((r) => r.id))
    .where("l.itemId", "is", null)
    .where("l.questionId", "is", null)
    .execute();

  return rows.map((row) => ({
    ...row,
    tags: tags
      .filter((t) => t.postId === row.id)
      .sort((x, y) => x.sortOrder - y.sortOrder)
      .map(({ kind, name, slug, examId }) => ({ kind, name, slug, examId })),
  }));
}

async function fetchHub(language?: CurrentAffairsLanguage): Promise<HubOutput> {
  await currentAffairsServer.promoteDue();
  const [daily, latest, editorials, weekly, monthly, dailyQuiz, anyQuiz, topics] = await Promise.all([
    selectCards({ contentType: "daily_digest", language }, DAILY_LIST + 1),
    selectCards({ language }, LATEST_LIST),
    selectCards({ contentType: "editorial_analysis", language }, EDITORIALS),
    selectCards({ contentType: "weekly_digest", language }, 1),
    selectCards({ contentType: "monthly_digest", language }, 1),
    selectCards({ contentType: "daily_digest", withQuiz: true, language }, 1),
    selectCards({ withQuiz: true, language }, 1),
    db
      .selectFrom("currentAffairsTags")
      .select(["name", "slug"])
      .where("kind", "=", "topic")
      .orderBy("sortOrder")
      .orderBy("name")
      .execute(),
  ]);
  return {
    latestDaily: daily[0] ?? null,
    daily: daily.slice(1),
    latest,
    editorials,
    weekly: weekly[0] ?? null,
    monthly: monthly[0] ?? null,
    quiz: dailyQuiz[0] ?? anyQuiz[0] ?? null,
    topics,
  };
}

async function fetchList(input: ListInput): Promise<ListOutput> {
  await currentAffairsServer.promoteDue();
  const page = input.page ?? 1;
  const filters: Filters = {
    contentType: input.type && input.type !== "quiz" ? TYPE_FILTERS[input.type] : undefined,
    withQuiz: input.type === "quiz",
    topicSlug: input.topic,
    examSlug: input.exam,
    language: input.lang,
  };
  const [countRow, rows, names] = await Promise.all([
    cardQuery(filters).select((eb) => eb.fn.countAll<string>().as("total")).executeTakeFirst(),
    selectCards(filters, PAGE_SIZE, (page - 1) * PAGE_SIZE),
    input.topic || input.exam
      ? db
          .selectFrom("currentAffairsTags")
          .select(["kind", "slug", "name"])
          .where((eb) =>
            eb.or([
              eb.and([eb("kind", "=", "topic"), eb("slug", "=", input.topic ?? "")]),
              eb.and([eb("kind", "=", "exam"), eb("slug", "=", input.exam ?? "")]),
            ])
          )
          .execute()
      : Promise.resolve([]),
  ]);
  const total = Number(countRow?.total ?? 0);
  return {
    rows,
    total,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    topicName: names.find((n) => n.kind === "topic")?.name ?? null,
    examName: names.find((n) => n.kind === "exam")?.name ?? null,
  };
}

type PublicDetailResult = { post: PublicDigestDetail; canonicalSlug: string; canonicalPath: string };

/** A published post in its public shape, with the path it lives at and live related posts only. */
async function publicDetail(id: number): Promise<PublicDetailResult | null> {
  const detail = await currentAffairsServer.loadDetail(id);
  if (!detail || detail.status !== "published") return null;

  const relatedIds = detail.related.map((r) => r.id);
  const live = relatedIds.length
    ? await db
        .selectFrom("currentAffairsPosts")
        .select(["id", "contentType", "slug", sql<string | null>`to_char(digest_date, 'YYYY-MM-DD')`.as("digestDate")])
        .where("id", "in", relatedIds)
        .where("status", "=", "published")
        .execute()
    : [];
  const livePaths = new Map(live.map((r) => [r.id, currentAffairsMeta.canonicalPath(r)]));

  const { createdByName: _c, updatedByName: _u, previousSlugs: _p, firstPublishedAt: _f, archivedAt: _a, createdAt: _cr, ...rest } = detail;
  const post: PublicDigestDetail = {
    ...rest,
    quiz: detail.quiz && detail.quiz.isPublished ? detail.quiz : null,
    related: detail.related
      .filter((r) => livePaths.has(r.id))
      .map(({ id, title, slug }) => ({ id, title, slug, path: livePaths.get(id)! })),
  };
  return { post, canonicalSlug: detail.slug, canonicalPath: currentAffairsMeta.canonicalPath(detail) };
}

/**
 * A published post by its slug, current or retired, for the old /current-affairs/{slug} URLs; the
 * result carries the path the post now lives at so the page can redirect. Null when nothing matches.
 */
async function fetchDetail(slug: string): Promise<PublicDetailResult | null> {
  await currentAffairsServer.promoteDue();
  const match = await db
    .selectFrom("currentAffairsPosts")
    .select(["id"])
    .where("status", "=", "published")
    .where((eb) => eb.or([eb("slug", "=", slug), sql<boolean>`previous_slugs @> ARRAY[${slug}]::text[]`]))
    .orderBy(sql`slug = ${slug}`, "desc")
    .executeTakeFirst();
  return match ? publicDetail(match.id) : null;
}

/**
 * The published digest for a period URL such as daily/2026-10-23, weekly/2026-w43 or monthly/2023-08.
 * The URL carries no language, so the English edition answers when both exist.
 */
async function fetchDetailByPeriod(type: ArchiveType, segment: string): Promise<PublicDetailResult | null> {
  const digestDate = currentAffairsMeta.periodFromSegment(type, segment);
  if (!digestDate) return null;
  await currentAffairsServer.promoteDue();
  const match = await db
    .selectFrom("currentAffairsPosts")
    .select(["id"])
    .where("status", "=", "published")
    .where("contentType", "=", currentAffairsMeta.ARCHIVE_CONTENT_TYPE[type])
    .where(sql<boolean>`digest_date = ${digestDate}::date`)
    .orderBy(sql`language = 'en'`, "desc")
    .orderBy("publishedAt", "desc")
    .executeTakeFirst();
  return match ? publicDetail(match.id) : null;
}

/** Every published post's public path and last edit, for the sitemap. */
async function fetchSitemapEntries(): Promise<{ path: string; updatedAt: Date }[]> {
  const rows = await db
    .selectFrom("currentAffairsPosts")
    .select(["contentType", "slug", "updatedAt", sql<string | null>`to_char(digest_date, 'YYYY-MM-DD')`.as("digestDate")])
    .where("status", "=", "published")
    .orderBy("publishedAt", "desc")
    .execute();
  const seen = new Set<string>();
  return rows.flatMap((row) => {
    const path = currentAffairsMeta.canonicalPath(row);
    if (seen.has(path)) return [];
    seen.add(path);
    return [{ path, updatedAt: row.updatedAt }];
  });
}

const shorten = (text: string, max: number) => (text.length <= max ? text : `${text.slice(0, max).replace(/\s+\S*$/, "")}...`);

/**
 * The news items of published daily digests, one row each: newest digest first, then in the order
 * the digest lists them. Each links to its section of the digest page.
 */
async function fetchDailyStories(input: StoriesInput): Promise<StoriesOutput> {
  await currentAffairsServer.promoteDue();
  const page = input.page ?? 1;
  let base = db
    .selectFrom("currentAffairsItems as i")
    .innerJoin("currentAffairsPosts as p", "p.id", "i.postId")
    .where("p.status", "=", "published")
    .where("p.contentType", "=", "daily_digest");
  if (input.lang) base = base.where("p.language", "=", input.lang);
  if (input.topic) {
    const topic = input.topic;
    base = base.where((eb) =>
      eb.exists(
        eb
          .selectFrom("currentAffairsTagLinks as l")
          .innerJoin("currentAffairsTags as t", "t.id", "l.tagId")
          .select("l.id")
          .whereRef("l.itemId", "=", "i.id")
          .where("t.kind", "=", "topic")
          .where("t.slug", "=", topic)
      )
    );
  }

  const [countRow, rows] = await Promise.all([
    base.select((eb) => eb.fn.countAll<string>().as("total")).executeTakeFirst(),
    base
      .select([
        "i.id",
        "i.headline",
        "i.anchorSlug",
        "i.whyInNews",
        "i.keyPoints",
        "i.imageUrl",
        "p.title as digestTitle",
        "p.slug",
        "p.contentType",
        "p.language",
        "p.publishedAt",
        sql<string | null>`coalesce(nullif(p.cover_image_url, ''), nullif(p.og_image_url, ''))`.as("digestImageUrl"),
        sql<string | null>`to_char(p.digest_date, 'YYYY-MM-DD')`.as("digestDate"),
      ])
      .orderBy(sql`coalesce(p.digest_date, (p.published_at at time zone 'Asia/Kolkata')::date)`, "desc")
      .orderBy("p.publishedAt", "desc")
      .orderBy("p.id", "desc")
      .orderBy("i.position", "asc")
      .limit(STORY_PAGE_SIZE)
      .offset((page - 1) * STORY_PAGE_SIZE)
      .execute(),
  ]);

  const tags = rows.length
    ? await db
        .selectFrom("currentAffairsTagLinks as l")
        .innerJoin("currentAffairsTags as t", "t.id", "l.tagId")
        .select(["l.itemId", "t.name", "t.slug", "t.sortOrder"])
        .where("l.itemId", "in", rows.map((r) => r.id))
        .where("t.kind", "=", "topic")
        .orderBy("t.sortOrder")
        .execute()
    : [];

  const total = Number(countRow?.total ?? 0);
  return {
    rows: rows.map((row) => {
      const plain = row.whyInNews.trim() || currentAffairsMeta.stripHtml(row.keyPoints);
      return {
        id: row.id,
        headline: row.headline,
        summary: shorten(plain, STORY_SUMMARY_CHARS),
        thumbnailUrl: row.imageUrl || row.digestImageUrl || null,
        digestTitle: row.digestTitle,
        digestDate: row.digestDate,
        publishedAt: row.publishedAt,
        language: row.language,
        href: `${currentAffairsMeta.canonicalPath(row)}${row.anchorSlug ? `#${row.anchorSlug}` : ""}`,
        tags: tags.filter((t) => t.itemId === row.id).map(({ name, slug }) => ({ name, slug })),
      };
    }),
    total,
    totalPages: Math.max(1, Math.ceil(total / STORY_PAGE_SIZE)),
  };
}

export const currentAffairsPublicServer = {
  fetchHub,
  fetchList,
  fetchDetail,
  fetchDetailByPeriod,
  fetchSitemapEntries,
  fetchDailyStories,
};