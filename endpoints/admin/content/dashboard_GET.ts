import { sql } from "kysely";
import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import {
  schema,
  CONTENT_STALE_DAYS,
  OutputType,
  SiteContentQueues,
  ArticleSurface,
  ArticleQueueCounts,
  SiteContentKpis,
  ContentSurface,
  SurfaceRow,
  SiteDailyPoint,
  MetadataCheck,
  TopReadRow,
  ExamPageTypeRow,
  StaleRow,
  SiteContentTotals,
} from "./dashboard_GET.schema";

const RANGE_DAYS = { "1d": 1, "7d": 7, "30d": 30, "90d": 90 } as const;

// The admin team works in India. IST has no daylight saving, so a fixed offset
// is exact and calendar days can be cut in JS without a timezone library.
const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const IST = "Asia/Kolkata";

type Row = Record<string, unknown>;

const toCamel = (key: string) => key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());

// The db instance runs CamelCasePlugin, which rewrites result keys of raw sql
// queries too, so a column aliased missing_seo arrives as missingSeo.
const get = (row: Row, key: string): unknown => row[key] ?? row[toCamel(key)];

const num = (value: unknown): number => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const nullableNum = (value: unknown): number | null =>
  value === null || value === undefined ? null : num(value);

const str = (value: unknown, fallback = ""): string =>
  value === null || value === undefined ? fallback : String(value);

const date = (value: unknown): Date => {
  const parsed = value instanceof Date ? value : new Date(str(value));
  return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
};

const isoDay = (utcMs: number): string => new Date(utcMs + IST_OFFSET_MS).toISOString().slice(0, 10);

/**
 * Local-midnight boundaries for "the last N calendar days including today" and
 * the N days before that. Returned as UTC instants for timestamptz comparisons,
 * plus the ISO day strings the daily series is generated over.
 */
function windowBounds(days: number) {
  const nowLocal = new Date(Date.now() + IST_OFFSET_MS);
  const todayLocalMidnightUtcMs =
    Date.UTC(nowLocal.getUTCFullYear(), nowLocal.getUTCMonth(), nowLocal.getUTCDate()) - IST_OFFSET_MS;
  const currentStartMs = todayLocalMidnightUtcMs - (days - 1) * DAY_MS;
  const previousStartMs = currentStartMs - days * DAY_MS;
  return {
    currentStart: new Date(currentStartMs),
    previousStart: new Date(previousStartMs),
    currentStartDay: isoDay(currentStartMs),
    todayDay: isoDay(todayLocalMidnightUtcMs),
  };
}

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request);

    const url = new URL(request.url);
    const { range } = schema.parse({ range: url.searchParams.get("range") ?? undefined });
    const days = RANGE_DAYS[range];
    const { currentStart, previousStart, currentStartDay, todayDay } = windowBounds(days);

    // Every timestamp on these tables is timestamptz, so the boundaries compare
    // directly - no naive-UTC conversion is needed here.
    const cur = sql`${currentStart}::timestamptz`;
    const prev = sql`${previousStart}::timestamptz`;
    // endpoints/admin/blog/posts/list_GET.ts filters with this same expression.
    const staleBefore = sql`(now() - (${CONTENT_STALE_DAYS}::int * interval '1 day'))`;

    // faq_items is jsonb and has held both arrays and nulls, so compare its text
    // form rather than calling jsonb_array_length on a non-array.
    const emptyFaq = sql`(faq_items IS NULL OR faq_items::text IN ('null', '[]', '{}'))`;

    const [queueRows, articleQueueRows, kpiRows, surfaceRows, dailyRows, metaRows, readRows, pageTypeRows, staleRows, totalRows] =
      await Promise.all([
        sql<Row>`
          SELECT
            (SELECT count(*) FROM blog_comments WHERE status = 'pending') AS comments_pending,
            -- Overview sections take their SEO from the exam record; the editor has no SEO fields for them.
            (SELECT count(*) FROM exam_content_pages
               WHERE status = 'published' AND page_type <> 'overview'
               AND (seo_title IS NULL OR seo_title = '' OR seo_description IS NULL OR seo_description = '')) AS exam_pages_missing_seo,
            (SELECT count(*) FROM exam_content_pages WHERE status = 'published' AND ${emptyFaq}) AS exam_pages_missing_faq,
            (SELECT count(*) FROM exam_content_pages
               WHERE published_at IS NOT NULL AND published_content IS DISTINCT FROM content) AS exam_pages_unpublished_edits,
            (SELECT count(*) FROM static_pages WHERE updated_at < ${staleBefore}) AS stale_static_pages,
            (SELECT count(*) FROM email_templates WHERE is_active = false) AS inactive_templates
        `.execute(db),

        // One row per type, so each dashboard tile matches one tab of /admin/blog.
        // The list endpoint's status + filter inputs reproduce each condition.
        sql<Row>`
          SELECT type::text AS type,
                 count(*) FILTER (WHERE status = 'draft') AS drafts,
                 count(*) FILTER (WHERE status = 'published'
                   AND (seo_title IS NULL OR seo_title = '' OR seo_description IS NULL OR seo_description = '')) AS missing_seo,
                 count(*) FILTER (WHERE status = 'published' AND (og_image IS NULL OR og_image = '')) AS missing_social_image,
                 count(*) FILTER (WHERE category_id IS NULL) AS uncategorised,
                 count(*) FILTER (WHERE status = 'published' AND updated_at < ${staleBefore}) AS stale
          FROM blog_posts
          GROUP BY type
        `.execute(db),

        sql<Row>`
          SELECT
            (SELECT count(*) FROM blog_posts WHERE published_at >= ${cur}) AS published_cur,
            (SELECT count(*) FROM blog_posts WHERE published_at >= ${prev} AND published_at < ${cur}) AS published_prev,
            (SELECT count(*) FROM blog_posts WHERE created_at >= ${cur}) AS created_cur,
            (SELECT count(*) FROM blog_posts WHERE created_at >= ${prev} AND created_at < ${cur}) AS created_prev,
            (SELECT count(*) FROM exam_content_pages WHERE published_at >= ${cur}) AS exam_pages_published_cur,
            (SELECT count(*) FROM exam_content_pages WHERE published_at >= ${prev} AND published_at < ${cur}) AS exam_pages_published_prev,
            (SELECT count(*) FROM blog_post_reactions WHERE created_at >= ${cur}) AS reactions_cur,
            (SELECT count(*) FROM blog_post_reactions WHERE created_at >= ${prev} AND created_at < ${cur}) AS reactions_prev,
            (SELECT count(*) FROM blog_comments WHERE created_at >= ${cur}) AS comments_cur,
            (SELECT count(*) FROM blog_comments WHERE created_at >= ${prev} AND created_at < ${cur}) AS comments_prev,
            (SELECT count(*) FROM career_applications WHERE created_at >= ${cur}) AS applications_cur,
            (SELECT count(*) FROM career_applications WHERE created_at >= ${prev} AND created_at < ${cur}) AS applications_prev
        `.execute(db),

        sql<Row>`
          SELECT 'blog' AS surface, count(*) AS total,
                 count(*) FILTER (WHERE status = 'published') AS published,
                 count(*) FILTER (WHERE status = 'draft') AS draft,
                 count(*) FILTER (WHERE status = 'archived') AS archived,
                 count(*) FILTER (WHERE created_at >= ${cur}) AS created_in_range,
                 count(*) FILTER (WHERE published_at >= ${cur}) AS published_in_range
          FROM blog_posts WHERE type = 'blog'
          UNION ALL
          SELECT 'knowledge_base', count(*),
                 count(*) FILTER (WHERE status = 'published'),
                 count(*) FILTER (WHERE status = 'draft'),
                 count(*) FILTER (WHERE status = 'archived'),
                 count(*) FILTER (WHERE created_at >= ${cur}),
                 count(*) FILTER (WHERE published_at >= ${cur})
          FROM blog_posts WHERE type = 'knowledge_base'
          UNION ALL
          SELECT 'exam_page', count(*),
                 count(*) FILTER (WHERE status = 'published'),
                 count(*) FILTER (WHERE status <> 'published'),
                 0::bigint,
                 count(*) FILTER (WHERE created_at >= ${cur}),
                 count(*) FILTER (WHERE published_at >= ${cur})
          FROM exam_content_pages
          UNION ALL
          SELECT 'static_page', count(*), count(*), 0::bigint, 0::bigint,
                 count(*) FILTER (WHERE created_at >= ${cur}), NULL::bigint
          FROM static_pages
          UNION ALL
          SELECT 'career', count(*),
                 count(*) FILTER (WHERE is_active = true),
                 count(*) FILTER (WHERE is_active = false),
                 0::bigint,
                 count(*) FILTER (WHERE created_at >= ${cur}), NULL::bigint
          FROM career_postings
          UNION ALL
          SELECT 'email_template', count(*),
                 count(*) FILTER (WHERE is_active = true),
                 count(*) FILTER (WHERE is_active = false),
                 0::bigint,
                 count(*) FILTER (WHERE created_at >= ${cur}), NULL::bigint
          FROM email_templates
        `.execute(db),

        sql<Row>`
          WITH days AS (
            SELECT generate_series(${currentStartDay}::date, ${todayDay}::date, interval '1 day')::date AS d
          ),
          b AS (
            SELECT (published_at AT TIME ZONE ${IST})::date AS d, count(*) AS n
            FROM blog_posts WHERE type = 'blog' AND published_at >= ${cur} GROUP BY 1
          ),
          k AS (
            SELECT (published_at AT TIME ZONE ${IST})::date AS d, count(*) AS n
            FROM blog_posts WHERE type = 'knowledge_base' AND published_at >= ${cur} GROUP BY 1
          ),
          e AS (
            SELECT (published_at AT TIME ZONE ${IST})::date AS d, count(*) AS n
            FROM exam_content_pages WHERE published_at >= ${cur} GROUP BY 1
          ),
          c AS (
            SELECT (created_at AT TIME ZONE ${IST})::date AS d, count(*) AS n
            FROM blog_posts WHERE created_at >= ${cur} GROUP BY 1
          )
          SELECT to_char(days.d, 'YYYY-MM-DD') AS day,
                 coalesce(b.n, 0) AS blog,
                 coalesce(k.n, 0) AS knowledge_base,
                 coalesce(e.n, 0) AS exam_page,
                 coalesce(c.n, 0) AS created
          FROM days
          LEFT JOIN b ON b.d = days.d
          LEFT JOIN k ON k.d = days.d
          LEFT JOIN e ON e.d = days.d
          LEFT JOIN c ON c.d = days.d
          ORDER BY days.d
        `.execute(db),

        sql<Row>`
          SELECT
            (SELECT count(*) FROM blog_posts) AS articles,
            (SELECT count(*) FROM blog_posts WHERE seo_title IS NOT NULL AND seo_title <> '') AS a_seo_title,
            (SELECT count(*) FROM blog_posts WHERE seo_description IS NOT NULL AND seo_description <> '') AS a_seo_description,
            (SELECT count(*) FROM blog_posts WHERE og_image IS NOT NULL AND og_image <> '') AS a_og_image,
            (SELECT count(*) FROM blog_posts WHERE featured_image IS NOT NULL AND featured_image <> '') AS a_featured_image,
            (SELECT count(*) FROM blog_posts WHERE excerpt IS NOT NULL AND excerpt <> '') AS a_excerpt,
            (SELECT count(*) FROM blog_posts WHERE category_id IS NOT NULL) AS a_category,
            (SELECT count(*) FROM exam_content_pages) AS exam_pages,
            (SELECT count(*) FROM exam_content_pages WHERE seo_title IS NOT NULL AND seo_title <> '') AS e_seo_title,
            (SELECT count(*) FROM exam_content_pages WHERE seo_description IS NOT NULL AND seo_description <> '') AS e_seo_description,
            (SELECT count(*) FROM exam_content_pages WHERE description IS NOT NULL AND description <> '') AS e_description,
            (SELECT count(*) FROM exam_content_pages WHERE NOT ${emptyFaq}) AS e_faq
        `.execute(db),

        sql<Row>`
          SELECT bp.id, bp.type::text AS surface, bp.title::text AS title,
                 coalesce(u.display_name, u.email) AS author, bp.view_count,
                 (SELECT count(*) FROM blog_post_reactions r WHERE r.post_id = bp.id AND r.reaction = 'like') AS likes,
                 (SELECT count(*) FROM blog_post_reactions r WHERE r.post_id = bp.id AND r.reaction = 'dislike') AS dislikes
          FROM blog_posts bp
          LEFT JOIN users u ON u.id = bp.author_id
          WHERE bp.status = 'published'
          ORDER BY bp.view_count DESC NULLS LAST, bp.published_at DESC
          LIMIT 8
        `.execute(db),

        sql<Row>`
          SELECT page_type, count(*) AS total,
                 count(*) FILTER (WHERE status = 'published') AS published,
                 count(*) FILTER (WHERE source = 'ai') AS ai_generated
          FROM exam_content_pages
          GROUP BY page_type
          ORDER BY count(*) DESC, page_type
        `.execute(db),

        sql<Row>`
          WITH oldest AS (
            (SELECT 'blog'::text AS surface, id, title::text AS title, updated_at,
                    NULL::text AS slug, NULL::int AS exam_id, NULL::text AS page_type
             FROM blog_posts WHERE type = 'blog' AND status = 'published' ORDER BY updated_at LIMIT 6)
            UNION ALL
            (SELECT 'knowledge_base', id, title::text, updated_at, NULL::text, NULL::int, NULL::text
             FROM blog_posts WHERE type = 'knowledge_base' AND status = 'published' ORDER BY updated_at LIMIT 6)
            UNION ALL
            (SELECT 'static_page', id, title::text, updated_at, slug::text, NULL::int, NULL::text
             FROM static_pages ORDER BY updated_at LIMIT 6)
            UNION ALL
            (SELECT 'exam_page', id, title::text, updated_at, NULL::text, exam_id, page_type::text
             FROM exam_content_pages WHERE status = 'published' ORDER BY updated_at LIMIT 6)
          )
          SELECT surface, id, title, updated_at, slug, exam_id, page_type FROM oldest ORDER BY updated_at LIMIT 8
        `.execute(db),

        sql<Row>`
          SELECT
            (SELECT count(*) FROM blog_posts) AS articles,
            (SELECT coalesce(sum(view_count), 0) FROM blog_posts) AS article_views,
            (SELECT count(*) FROM blog_categories) AS categories,
            (SELECT count(*) FROM blog_tags) AS tags,
            (SELECT count(*) FROM blog_post_reactions) AS reactions,
            (SELECT count(*) FROM blog_comments) AS comments,
            (SELECT count(*) FROM exam_content_pages) AS exam_pages,
            (SELECT count(DISTINCT exam_id) FROM exam_content_pages) AS exams_with_pages,
            (SELECT count(*) FROM exams) AS exams,
            (SELECT count(*) FROM static_pages) AS static_pages,
            (SELECT count(*) FROM career_postings) AS careers,
            (SELECT count(*) FROM career_applications) AS applications,
            (SELECT count(*) FROM email_templates) AS email_templates
        `.execute(db),
      ]);

    const q = queueRows.rows[0] ?? {};
    const articleQueues = (type: ArticleSurface): ArticleQueueCounts => {
      const row = articleQueueRows.rows.find((r) => get(r, "type") === type) ?? {};
      return {
        drafts: num(get(row, "drafts")),
        missingSeo: num(get(row, "missing_seo")),
        missingSocialImage: num(get(row, "missing_social_image")),
        uncategorised: num(get(row, "uncategorised")),
        stale: num(get(row, "stale")),
      };
    };
    // Summed over every type row, so the combined counts can never drift from the split.
    const allArticles = (key: string) => articleQueueRows.rows.reduce((sum, row) => sum + num(get(row, key)), 0);
    const staleStaticPages = num(get(q, "stale_static_pages"));
    const queues: SiteContentQueues = {
      commentsPending: num(get(q, "comments_pending")),
      drafts: allArticles("drafts"),
      missingSeo: allArticles("missing_seo"),
      missingSocialImage: allArticles("missing_social_image"),
      uncategorised: allArticles("uncategorised"),
      examPagesMissingSeo: num(get(q, "exam_pages_missing_seo")),
      examPagesMissingFaq: num(get(q, "exam_pages_missing_faq")),
      examPagesUnpublishedEdits: num(get(q, "exam_pages_unpublished_edits")),
      stalePages: allArticles("stale") + staleStaticPages,
      inactiveTemplates: num(get(q, "inactive_templates")),
      articles: { blog: articleQueues("blog"), knowledge_base: articleQueues("knowledge_base") },
      staleStaticPages,
    };

    const k = kpiRows.rows[0] ?? {};
    const pair = (key: string) => ({ current: num(get(k, `${key}_cur`)), previous: num(get(k, `${key}_prev`)) });
    const kpis: SiteContentKpis = {
      published: pair("published"),
      created: pair("created"),
      examPagesPublished: pair("exam_pages_published"),
      reactions: pair("reactions"),
      comments: pair("comments"),
      applications: pair("applications"),
    };

    const surfaces: SurfaceRow[] = surfaceRows.rows.map((row) => ({
      surface: str(get(row, "surface"), "blog") as ContentSurface,
      total: num(get(row, "total")),
      published: num(get(row, "published")),
      draft: num(get(row, "draft")),
      archived: num(get(row, "archived")),
      createdInRange: num(get(row, "created_in_range")),
      publishedInRange: nullableNum(get(row, "published_in_range")),
    }));

    const daily: SiteDailyPoint[] = dailyRows.rows.map((row) => ({
      day: str(get(row, "day")),
      blog: num(get(row, "blog")),
      knowledgeBase: num(get(row, "knowledge_base")),
      examPage: num(get(row, "exam_page")),
      created: num(get(row, "created")),
    }));

    const m = metaRows.rows[0] ?? {};
    const articles = num(get(m, "articles"));
    const examPages = num(get(m, "exam_pages"));
    const metadata: MetadataCheck[] = [
      { key: "a_seo_title", label: "SEO title", scope: "articles", complete: num(get(m, "a_seo_title")), total: articles },
      {
        key: "a_seo_description",
        label: "SEO description",
        scope: "articles",
        complete: num(get(m, "a_seo_description")),
        total: articles,
      },
      { key: "a_excerpt", label: "Excerpt", scope: "articles", complete: num(get(m, "a_excerpt")), total: articles },
      { key: "a_category", label: "Category", scope: "articles", complete: num(get(m, "a_category")), total: articles },
      {
        key: "a_featured_image",
        label: "Featured image",
        scope: "articles",
        complete: num(get(m, "a_featured_image")),
        total: articles,
      },
      { key: "a_og_image", label: "Social image", scope: "articles", complete: num(get(m, "a_og_image")), total: articles },
      {
        key: "e_seo_title",
        label: "SEO title",
        scope: "exam_pages",
        complete: num(get(m, "e_seo_title")),
        total: examPages,
      },
      {
        key: "e_seo_description",
        label: "SEO description",
        scope: "exam_pages",
        complete: num(get(m, "e_seo_description")),
        total: examPages,
      },
      {
        key: "e_description",
        label: "Description",
        scope: "exam_pages",
        complete: num(get(m, "e_description")),
        total: examPages,
      },
      { key: "e_faq", label: "FAQ block", scope: "exam_pages", complete: num(get(m, "e_faq")), total: examPages },
    ];

    const topReads: TopReadRow[] = readRows.rows.map((row) => ({
      id: num(get(row, "id")),
      surface: str(get(row, "surface"), "blog") as ContentSurface,
      title: str(get(row, "title"), "Untitled").trim(),
      author: get(row, "author") ? str(get(row, "author")) : null,
      views: num(get(row, "view_count")),
      likes: num(get(row, "likes")),
      dislikes: num(get(row, "dislikes")),
    }));

    const examPageTypes: ExamPageTypeRow[] = pageTypeRows.rows.map((row) => ({
      pageType: str(get(row, "page_type"), "other"),
      total: num(get(row, "total")),
      published: num(get(row, "published")),
      aiGenerated: num(get(row, "ai_generated")),
    }));

    const stale: StaleRow[] = staleRows.rows.map((row) => ({
      surface: str(get(row, "surface"), "blog") as ContentSurface,
      id: num(get(row, "id")),
      title: str(get(row, "title"), "Untitled").trim(),
      updatedAt: date(get(row, "updated_at")),
      slug: get(row, "slug") ? str(get(row, "slug")) : null,
      examId: nullableNum(get(row, "exam_id")),
      pageType: get(row, "page_type") ? str(get(row, "page_type")) : null,
    }));

    const t = totalRows.rows[0] ?? {};
    const totals: SiteContentTotals = {
      articles: num(get(t, "articles")),
      articleViews: num(get(t, "article_views")),
      categories: num(get(t, "categories")),
      tags: num(get(t, "tags")),
      reactions: num(get(t, "reactions")),
      comments: num(get(t, "comments")),
      examPages: num(get(t, "exam_pages")),
      examsWithPages: num(get(t, "exams_with_pages")),
      exams: num(get(t, "exams")),
      staticPages: num(get(t, "static_pages")),
      careers: num(get(t, "careers")),
      applications: num(get(t, "applications")),
      emailTemplates: num(get(t, "email_templates")),
    };

    const output: OutputType = {
      range,
      days,
      generatedAt: new Date(),
      queues,
      kpis,
      surfaces,
      daily,
      metadata,
      topReads,
      examPageTypes,
      stale,
      totals,
    };

    return new Response(superjson.stringify(output), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error building admin site content dashboard:", error);
    if (error instanceof Error && error.name === "NotAuthenticatedError") {
      return new Response(superjson.stringify({ error: "Not authenticated" }), { status: 401 });
    }
    if (error instanceof Error && error.name === "ForbiddenError") {
      return new Response(superjson.stringify({ error: error.message }), { status: 403 });
    }
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 500 });
  }
}
