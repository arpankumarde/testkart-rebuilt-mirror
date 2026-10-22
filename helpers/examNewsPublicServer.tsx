import { sql } from "kysely";
import { db } from "./db";
import { examNewsServer } from "./examNewsServer";
import { examNewsPublicMeta } from "./examNewsPublicMeta";
import type { ExamNewsType } from "./schema";
import type { InputType as ListInput, OutputType as ListOutput, PublicExamNewsCard } from "../endpoints/exam-news/list_GET.schema";
import type { OutputType as SidebarOutput, PublicExamNewsExam } from "../endpoints/exam-news/sidebar_GET.schema";
import type { OutputType as DetailOutput } from "../endpoints/exam-news/details_GET.schema";

/*
 * Public reads for the Exam News pages, shared by the /_api/exam-news/* endpoints, the SSR
 * prefetches (a prefetch cannot call the app's own endpoints) and the sitemap. Every query is
 * limited to status "published"; drafts, scheduled and archived stories never leave the server here.
 */

const RELATED = 4;
const RECENTLY_UPDATED = 5;
const EXAMS_WITH_NEWS = 12;

type Filters = { type?: ExamNewsType; examId?: number; q?: string };

const escapeLike = (value: string) => value.replace(/[%_\\]/g, (c) => `\\${c}`);

function baseQuery(filters: Filters) {
  let query = db
    .selectFrom("examNewsPosts as p")
    .leftJoin("exams as e", "e.id", "p.examId")
    .where("p.status", "=", "published");
  if (filters.type) query = query.where("p.newsType", "=", filters.type);
  if (filters.examId) query = query.where("p.examId", "=", filters.examId);
  if (filters.q) query = query.where("p.title", "ilike", `%${escapeLike(filters.q)}%`);
  return query;
}

async function selectCards(filters: Filters, limit: number, offset = 0, excludeId?: number): Promise<PublicExamNewsCard[]> {
  let query = baseQuery(filters);
  if (excludeId) query = query.where("p.id", "!=", excludeId);
  return query
    .select([
      "p.id",
      "p.title",
      "p.slug",
      "p.summary",
      "p.newsType",
      "p.publishedAt",
      "p.updatedAt",
      "e.examName as examName",
      "e.examSlug as examSlug",
      // The hero image, else the sharing image; never a stand-in.
      sql<string | null>`coalesce(nullif(p.hero_image_url, ''), nullif(p.og_image_url, ''))`.as("thumbnailUrl"),
      "p.heroImageAlt as thumbnailAlt",
    ])
    .orderBy("p.publishedAt", "desc")
    .orderBy("p.id", "desc")
    .limit(limit)
    .offset(offset)
    .execute();
}

async function findExam(slug: string) {
  return db.selectFrom("exams").select(["id", "examName", "examSlug"]).where("examSlug", "=", slug).executeTakeFirst();
}

async function fetchList(input: ListInput): Promise<ListOutput> {
  await examNewsServer.promoteDue();
  const page = input.page ?? 1;
  const pageSize = examNewsPublicMeta.PAGE_SIZE;

  let exam: { id: number; examName: string; examSlug: string } | undefined;
  if (input.exam) {
    exam = await findExam(input.exam);
    if (!exam) return { rows: [], total: 0, totalPages: 1, page, exam: null };
  }

  const filters: Filters = { type: input.type, examId: exam?.id, q: input.q || undefined };
  const [rows, countRow] = await Promise.all([
    selectCards(filters, pageSize, (page - 1) * pageSize),
    baseQuery(filters).select((eb) => eb.fn.countAll<string>().as("count")).executeTakeFirst(),
  ]);
  const total = Number(countRow?.count ?? 0);
  return {
    rows,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    page,
    exam: exam ? { id: exam.id, name: exam.examName, slug: exam.examSlug } : null,
  };
}

async function fetchSidebar(): Promise<SidebarOutput> {
  await examNewsServer.promoteDue();
  const [popular, withNews, typeRows, recentlyUpdated] = await Promise.all([
    db
      .selectFrom("exams as e")
      .select([
        "e.examName as name",
        "e.examSlug as slug",
        (eb) =>
          eb
            .selectFrom("examNewsPosts as p")
            .select((inner) => inner.fn.countAll<string>().as("n"))
            .whereRef("p.examId", "=", "e.id")
            .where("p.status", "=", "published")
            .as("count"),
      ])
      .where("e.examSlug", "in", [...examNewsPublicMeta.POPULAR_EXAM_SLUGS])
      .execute(),
    db
      .selectFrom("examNewsPosts as p")
      .innerJoin("exams as e", "e.id", "p.examId")
      .select(["e.examName as name", "e.examSlug as slug", (eb) => eb.fn.countAll<string>().as("count")])
      .where("p.status", "=", "published")
      .groupBy(["e.examName", "e.examSlug"])
      .orderBy(sql`count(*)`, "desc")
      .orderBy("e.examName")
      .limit(EXAMS_WITH_NEWS)
      .execute(),
    db
      .selectFrom("examNewsPosts")
      .select(["newsType", (eb) => eb.fn.countAll<string>().as("count")])
      .where("status", "=", "published")
      .groupBy("newsType")
      .execute(),
    db
      .selectFrom("examNewsPosts as p")
      .leftJoin("exams as e", "e.id", "p.examId")
      .select(["p.title", "p.slug", "p.newsType", "e.examName as examName", "p.lastEditedAt"])
      .where("p.status", "=", "published")
      .where("p.lastEditedAt", "is not", null)
      .orderBy("p.lastEditedAt", "desc")
      .limit(RECENTLY_UPDATED)
      .$narrowType<{ lastEditedAt: Date }>()
      .execute(),
  ]);

  const toExam = (row: { name: string; slug: string; count: string | number | null }): PublicExamNewsExam => ({
    name: row.name,
    slug: row.slug,
    count: Number(row.count ?? 0),
  });
  const order = examNewsPublicMeta.POPULAR_EXAM_SLUGS as readonly string[];

  return {
    popularExams: popular.map(toExam).sort((a, b) => order.indexOf(a.slug) - order.indexOf(b.slug)),
    examsWithNews: withNews.map(toExam),
    typeCounts: Object.fromEntries(typeRows.map((row) => [row.newsType, Number(row.count)])),
    recentlyUpdated,
  };
}

const day = (column: string) => sql<string | null>`to_char(${sql.ref(column)}, 'YYYY-MM-DD')`;

/** A published story by its slug or a slug it used to have; null when there is none. */
async function fetchDetail(slug: string): Promise<DetailOutput | null> {
  await examNewsServer.promoteDue();
  const post = await db
    .selectFrom("examNewsPosts as p")
    .leftJoin("exams as e", "e.id", "p.examId")
    .leftJoin("admins as a", "a.id", "p.authorId")
    .selectAll("p")
    .select(["e.examName as examName", "e.examSlug as examSlug", "a.fullName as authorName"])
    .where("p.status", "=", "published")
    .where((eb) => eb.or([eb("p.slug", "=", slug), sql<boolean>`p.previous_slugs @> ARRAY[${slug}]::text[]`]))
    .orderBy(sql`p.slug = ${slug}`, "desc")
    .executeTakeFirst();
  if (!post) return null;

  const [keyDates, sources, corrections, sameExam] = await Promise.all([
    db
      .selectFrom("examNewsKeyDates")
      .select([
        "eventName",
        "note",
        "startLabel as startDate",
        "endLabel as endDate",
        "examLabel as examDate",
        "resultLabel as resultDate",
      ])
      .where("postId", "=", post.id)
      .orderBy("position")
      .execute(),
    db.selectFrom("examNewsSources").select(["name", "url"]).where("postId", "=", post.id).orderBy("position").execute(),
    db
      .selectFrom("examNewsCorrections")
      .select(["note", day("corrected_on").as("date")])
      .where("postId", "=", post.id)
      .orderBy("position")
      .execute(),
    post.examId ? selectCards({ examId: post.examId }, RELATED, 0, post.id) : Promise.resolve([]),
  ]);
  const related = sameExam.length > 0 ? sameExam : await selectCards({}, RELATED, 0, post.id);

  return {
    story: {
      id: post.id,
      title: post.title,
      slug: post.slug,
      summary: post.summary,
      newsType: post.newsType,
      exam: post.examName && post.examSlug ? { name: post.examName, slug: post.examSlug } : null,
      authorName: post.authorName,
      body: post.body,
      heroImageUrl: post.heroImageUrl,
      heroImageAlt: post.heroImageAlt,
      heroImageCredit: post.heroImageCredit,
      publishedAt: post.publishedAt,
      updatedAt: post.updatedAt,
      keyDates: keyDates.map((row) => ({ ...row, note: row.note || null })),
      officialSource: post.officialSourceUrl
        ? { name: post.officialSourceName || post.officialSourceUrl, url: post.officialSourceUrl }
        : null,
      sources,
      corrections: corrections.filter((c): c is { note: string; date: string } => !!c.date),
      seoTitle: post.seoTitle,
      seoDescription: post.seoDescription,
      ogTitle: post.ogTitle,
      ogDescription: post.ogDescription,
      ogImageUrl: post.ogImageUrl,
      canonicalUrl: post.canonicalUrl,
    },
    canonicalPath: examNewsPublicMeta.storyPath(post.slug),
    related,
    relatedIsSameExam: sameExam.length > 0,
  };
}

/** Every indexable Exam News URL: the hub, listings that have stories, and each story. */
async function fetchSitemapEntries(): Promise<{ path: string; updatedAt: Date | null }[]> {
  await examNewsServer.promoteDue();
  const [stories, types, exams] = await Promise.all([
    db
      .selectFrom("examNewsPosts")
      .select(["slug", "updatedAt"])
      .where("status", "=", "published")
      .orderBy("publishedAt", "desc")
      .execute(),
    db
      .selectFrom("examNewsPosts")
      .select(["newsType", (eb) => eb.fn.max("updatedAt").as("updatedAt")])
      .where("status", "=", "published")
      .groupBy("newsType")
      .execute(),
    db
      .selectFrom("examNewsPosts as p")
      .innerJoin("exams as e", "e.id", "p.examId")
      .select(["e.examSlug", (eb) => eb.fn.max("p.updatedAt").as("updatedAt")])
      .where("p.status", "=", "published")
      .groupBy("e.examSlug")
      .execute(),
  ]);
  if (stories.length === 0) return [{ path: examNewsPublicMeta.HUB_PATH, updatedAt: null }];
  return [
    { path: examNewsPublicMeta.HUB_PATH, updatedAt: stories.reduce<Date | null>((max, s) => (!max || s.updatedAt > max ? s.updatedAt : max), null) },
    ...types.map((t) => ({ path: examNewsPublicMeta.listingPath({ type: t.newsType }), updatedAt: t.updatedAt as Date | null })),
    ...exams.map((e) => ({ path: examNewsPublicMeta.listingPath({ examSlug: e.examSlug }), updatedAt: e.updatedAt as Date | null })),
    ...stories.map((s) => ({ path: examNewsPublicMeta.storyPath(s.slug), updatedAt: s.updatedAt })),
  ];
}

export const examNewsPublicServer = {
  fetchList,
  fetchSidebar,
  fetchDetail,
  fetchSitemapEntries,
};
