import { z } from "zod";
import superjson from "superjson";

export const SiteRangeValues = ["1d", "7d", "30d", "90d"] as const;
export type SiteRange = (typeof SiteRangeValues)[number];

/* Published copy nobody has touched in this long counts as stale, on the dashboard and on the lists it links to. */
export const CONTENT_STALE_DAYS = 90;

export const schema = z.object({
  range: z.enum(SiteRangeValues).default("30d"),
});

export type InputType = z.infer<typeof schema>;

/** The surfaces the Testkart team writes itself. */
export const ContentSurfaceValues = [
  "blog",
  "knowledge_base",
  "exam_page",
  "static_page",
  "career",
  "email_template",
] as const;
export type ContentSurface = (typeof ContentSurfaceValues)[number];

/** The two blog_posts types, each listed on its own tab of /admin/blog. */
export type ArticleSurface = Extract<ContentSurface, "blog" | "knowledge_base">;

/** One article type's share of the article queues, with the same conditions as the combined counts. */
export type ArticleQueueCounts = {
  drafts: number;
  missingSeo: number;
  missingSocialImage: number;
  uncategorised: number;
  stale: number;
};

/**
 * Editorial work queues and metadata gaps, as counts. The article queues are
 * also split by type in `articles`, and stalePages is both types' stale
 * counts plus staleStaticPages.
 */
export type SiteContentQueues = {
  commentsPending: number;
  drafts: number;
  missingSeo: number;
  missingSocialImage: number;
  uncategorised: number;
  examPagesMissingSeo: number;
  examPagesMissingFaq: number;
  examPagesUnpublishedEdits: number;
  stalePages: number;
  inactiveTemplates: number;
  articles: Record<ArticleSurface, ArticleQueueCounts>;
  staleStaticPages: number;
};

export type KpiPair = { current: number; previous: number };

export type SiteContentKpis = {
  published: KpiPair;
  created: KpiPair;
  examPagesPublished: KpiPair;
  reactions: KpiPair;
  comments: KpiPair;
  applications: KpiPair;
};

/**
 * One row per surface. `publishedInRange` is null where the surface keeps no
 * publish timestamp - static pages, careers and email templates only have an
 * active flag or a last-edit date.
 */
export type SurfaceRow = {
  surface: ContentSurface;
  total: number;
  published: number;
  draft: number;
  archived: number;
  createdInRange: number;
  publishedInRange: number | null;
};

/** One calendar day in Asia/Kolkata. `day` is YYYY-MM-DD. */
export type SiteDailyPoint = {
  day: string;
  blog: number;
  knowledgeBase: number;
  examPage: number;
  created: number;
};

/** A metadata field that is either filled in or not, counted across a scope. */
export type MetadataCheck = {
  key: string;
  label: string;
  scope: "articles" | "exam_pages";
  complete: number;
  total: number;
};

export type TopReadRow = {
  id: number;
  surface: ContentSurface;
  title: string;
  author: string | null;
  views: number;
  likes: number;
  dislikes: number;
};

export type ExamPageTypeRow = {
  pageType: string;
  total: number;
  published: number;
  aiGenerated: number;
};

/** slug is set for static pages; examId and pageType for exam pages. */
export type StaleRow = {
  surface: ContentSurface;
  id: number;
  title: string;
  updatedAt: Date;
  slug: string | null;
  examId: number | null;
  pageType: string | null;
};

export type SiteContentTotals = {
  articles: number;
  articleViews: number;
  categories: number;
  tags: number;
  reactions: number;
  comments: number;
  examPages: number;
  examsWithPages: number;
  exams: number;
  staticPages: number;
  careers: number;
  applications: number;
  emailTemplates: number;
};

export type OutputType = {
  range: SiteRange;
  days: number;
  generatedAt: Date;
  queues: SiteContentQueues;
  kpis: SiteContentKpis;
  surfaces: SurfaceRow[];
  daily: SiteDailyPoint[];
  metadata: MetadataCheck[];
  topReads: TopReadRow[];
  examPageTypes: ExamPageTypeRow[];
  stale: StaleRow[];
  totals: SiteContentTotals;
};

export const getAdminSiteContentDashboard = async (
  query: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const params = new URLSearchParams({ range: query.range });
  const result = await fetch(`/_api/admin/content/dashboard?${params.toString()}`, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};
