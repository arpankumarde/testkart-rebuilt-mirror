import { sql } from "kysely";
import { db } from "./db";
import { currentAffairsServer } from "./currentAffairsServer";
import type { CurrentAffairsContentType, CurrentAffairsLanguage } from "./schema";
import type { OutputType as HubOutput, PublicDigestCard } from "../endpoints/current-affairs/hub_GET.schema";
import type { InputType as ListInput, OutputType as ListOutput, PublicListType } from "../endpoints/current-affairs/list_GET.schema";
import type { PublicDigestDetail } from "../endpoints/current-affairs/details_GET.schema";

/*
 * Public reads for the Current Affairs pages, shared by the /_api/current-affairs/* endpoints and
 * the SSR prefetches (a prefetch cannot call the app's own endpoints). Every query is limited to
 * status "published"; drafts, scheduled and archived posts never leave the server here.
 */

const PAGE_SIZE = 12;
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
  const [daily, latest, editorials, weekly, monthly, dailyQuiz, anyQuiz] = await Promise.all([
    selectCards({ contentType: "daily_digest", language }, DAILY_LIST + 1),
    selectCards({ language }, LATEST_LIST),
    selectCards({ contentType: "editorial_analysis", language }, EDITORIALS),
    selectCards({ contentType: "weekly_digest", language }, 1),
    selectCards({ contentType: "monthly_digest", language }, 1),
    selectCards({ contentType: "daily_digest", withQuiz: true, language }, 1),
    selectCards({ withQuiz: true, language }, 1),
  ]);
  return {
    latestDaily: daily[0] ?? null,
    daily: daily.slice(1),
    latest,
    editorials,
    weekly: weekly[0] ?? null,
    monthly: monthly[0] ?? null,
    quiz: dailyQuiz[0] ?? anyQuiz[0] ?? null,
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

/**
 * A published post by its slug. Returns the canonical slug too, so a request on a retired slug can
 * redirect; null when nothing published answers to it.
 */
async function fetchDetail(slug: string): Promise<{ post: PublicDigestDetail; canonicalSlug: string } | null> {
  await currentAffairsServer.promoteDue();
  const match = await db
    .selectFrom("currentAffairsPosts")
    .select(["id", "slug"])
    .where("status", "=", "published")
    .where((eb) => eb.or([eb("slug", "=", slug), sql<boolean>`previous_slugs @> ARRAY[${slug}]::text[]`]))
    .orderBy(sql`slug = ${slug}`, "desc")
    .executeTakeFirst();
  if (!match) return null;

  const detail = await currentAffairsServer.loadDetail(match.id);
  if (!detail || detail.status !== "published") return null;

  const relatedIds = detail.related.map((r) => r.id);
  const live = relatedIds.length
    ? await db
        .selectFrom("currentAffairsPosts")
        .select("id")
        .where("id", "in", relatedIds)
        .where("status", "=", "published")
        .execute()
    : [];
  const liveIds = new Set(live.map((r) => r.id));

  const { createdByName: _c, updatedByName: _u, previousSlugs: _p, firstPublishedAt: _f, archivedAt: _a, createdAt: _cr, ...rest } = detail;
  const post: PublicDigestDetail = {
    ...rest,
    quiz: detail.quiz && detail.quiz.isPublished ? detail.quiz : null,
    related: detail.related.filter((r) => liveIds.has(r.id)).map(({ id, title, slug: relatedSlug }) => ({ id, title, slug: relatedSlug })),
  };
  return { post, canonicalSlug: match.slug };
}

export const currentAffairsPublicServer = { fetchHub, fetchList, fetchDetail };