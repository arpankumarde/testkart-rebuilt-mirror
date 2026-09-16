import { db } from "../helpers/db";
import { slugify } from "../helpers/slugify";
import { EXAM_CONTENT_PAGE_META, type ExamContentPageType } from "../helpers/examContentTypes";
import {
  getIndexableMockTestIds,
  getIndexableStudyNoteIds,
  getIndexableCourseIds,
  getIndexableBundleIds,
} from "../helpers/fetchIndexableUgcIds";

const BASE_URL = "https://testkart.in";

type UrlEntry = {
  loc: string;
  lastmod?: string;
  changefreq: "daily" | "weekly" | "monthly" | "yearly" | "always" | "never";
  priority: number;
};

function toW3CDate(date: Date | string | null | undefined): string | undefined {
  if (!date) return undefined;
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return undefined;
  return d.toISOString().split("T")[0]; // YYYY-MM-DD
}

function generateUrlEntry(entry: UrlEntry): string {
  const lastmodTag = entry.lastmod ? `<lastmod>${entry.lastmod}</lastmod>` : "";
  return `
  <url>
    <loc>${entry.loc}</loc>${lastmodTag}
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority.toFixed(1)}</priority>
  </url>`;
}

export async function handle(request: Request) {
  try {
    const staticPages: UrlEntry[] = [
      { loc: `${BASE_URL}/`, changefreq: "daily", priority: 1.0 },
      { loc: `${BASE_URL}/teachers`, changefreq: "weekly", priority: 0.9 },
      { loc: `${BASE_URL}/exams`, changefreq: "weekly", priority: 0.9 },
      { loc: `${BASE_URL}/mock-test`, changefreq: "daily", priority: 0.9 },
      { loc: `${BASE_URL}/mock-test/live`, changefreq: "daily", priority: 0.9 },
      { loc: `${BASE_URL}/course`, changefreq: "weekly", priority: 0.9 },
      { loc: `${BASE_URL}/study-notes`, changefreq: "weekly", priority: 0.9 },
      { loc: `${BASE_URL}/bundles`, changefreq: "weekly", priority: 0.8 },
      { loc: `${BASE_URL}/blog`, changefreq: "weekly", priority: 0.8 },
      { loc: `${BASE_URL}/help`, changefreq: "weekly", priority: 0.8 },
      { loc: `${BASE_URL}/about`, changefreq: "monthly", priority: 0.6 },
      { loc: `${BASE_URL}/careers`, changefreq: "weekly", priority: 0.6 },
      { loc: `${BASE_URL}/news-and-events`, changefreq: "weekly", priority: 0.6 },
      { loc: `${BASE_URL}/sell`, changefreq: "monthly", priority: 0.6 },
      { loc: `${BASE_URL}/ai-mock-test-generator`, changefreq: "monthly", priority: 0.6 },
      { loc: `${BASE_URL}/ai-quiz-generator`, changefreq: "monthly", priority: 0.6 },
      { loc: `${BASE_URL}/ugc-net-swmg-success-with-mukesh-goyal`, changefreq: "weekly", priority: 0.8 },
      { loc: `${BASE_URL}/ugc-net-swmg-success-with-mukesh-goyal/environmental-science`, changefreq: "weekly", priority: 0.7 },
      { loc: `${BASE_URL}/ugc-net-swmg-success-with-mukesh-goyal/reviews`, changefreq: "weekly", priority: 0.7 },
      { loc: `${BASE_URL}/contact`, changefreq: "yearly", priority: 0.3 },
      { loc: `${BASE_URL}/privacy`, changefreq: "yearly", priority: 0.2 },
      { loc: `${BASE_URL}/terms`, changefreq: "yearly", priority: 0.2 },
      { loc: `${BASE_URL}/refund`, changefreq: "yearly", priority: 0.2 },
    ];

    const [
      teachers,
      liveTests,
      exams,
      blogPosts,
      examContentPages,
      examsWithCourses,
      examsWithDigitalProducts,
      examsWithBundles,
      careerPostings,
      newsCoverage,
    ] = await Promise.all([
      db
        .selectFrom("users")
        .where("role", "=", "teacher")
        .where("isActive", "=", true)
        .select(["displayName", "slug"])
        .execute(),
      db
        .selectFrom("liveTests")
        .where("isActive", "=", true)
        .select(["id", "updatedAt"])
        .execute(),
      db
        .selectFrom("exams")
        .innerJoin("mockTests", "mockTests.examId", "exams.id")
        .where("mockTests.isPublished", "=", true)
        .where("mockTests.deletedAt", "is", null)
        .select(["exams.examSlug", "exams.updatedAt"])
        .distinct()
        .execute(),
      db
        .selectFrom("blogPosts")
        .where("status", "=", "published")
        .select(["slug", "type", "updatedAt"])
        .execute(),
      db
        .selectFrom("examContentPages")
        .innerJoin("exams", "exams.id", "examContentPages.examId")
        .where("examContentPages.status", "=", "published")
        .select(["exams.examSlug", "examContentPages.pageType", "examContentPages.publishedAt"])
        .execute(),
      // Per-exam-per-type product sub-pages only get a sitemap entry (and
      // therefore only "exist" as a crawlable URL) when the exam actually
      // has at least one published product of that type — mirrors the same
      // hide-if-empty rule the pages themselves enforce via redirect.
      db
        .selectFrom("exams")
        .where((eb) =>
          eb.exists(
            eb
              .selectFrom("courses")
              .whereRef("courses.examId", "=", "exams.id")
              .where("courses.status", "=", "published")
              .select("courses.id")
          )
        )
        .select(["exams.examSlug", "exams.updatedAt"])
        .distinct()
        .execute(),
      db
        .selectFrom("exams")
        .where((eb) =>
          eb.exists(
            eb
              .selectFrom("digitalProducts")
              .whereRef("digitalProducts.examId", "=", "exams.id")
              .where("digitalProducts.status", "=", "published")
              .where("digitalProducts.isPublished", "=", true)
              .select("digitalProducts.id")
          )
        )
        .select(["exams.examSlug", "exams.updatedAt"])
        .distinct()
        .execute(),
      db
        .selectFrom("exams")
        .where((eb) =>
          eb.exists(
            eb
              .selectFrom("courseBundles")
              .innerJoin("courseBundleItems", "courseBundleItems.bundleId", "courseBundles.id")
              .leftJoin("mockTests", "mockTests.id", "courseBundleItems.mockTestId")
              .leftJoin("digitalProducts", "digitalProducts.id", "courseBundleItems.digitalProductId")
              .leftJoin("courses", "courses.id", "courseBundleItems.courseId")
              .where("courseBundles.isPublished", "=", true)
              .where((eb2) =>
                eb2.or([
                  eb2("mockTests.examId", "=", eb.ref("exams.id")),
                  eb2("digitalProducts.examId", "=", eb.ref("exams.id")),
                  eb2("courses.examId", "=", eb.ref("exams.id")),
                ])
              )
              .select("courseBundles.id")
          )
        )
        .select(["exams.examSlug", "exams.updatedAt"])
        .distinct()
        .execute(),
      db
        .selectFrom("careerPostings")
        .where("careerPostings.isActive", "=", true)
        .select(["careerPostings.slug", "careerPostings.updatedAt"])
        .execute(),
      db
        .selectFrom("newsCoverage")
        .where("newsCoverage.isPublished", "=", true)
        .select(["newsCoverage.slug", "newsCoverage.updatedAt"])
        .execute(),
    ]);

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

    // Add static pages
    for (const page of staticPages) {
      xml += generateUrlEntry(page);
    }

    // Mock tests — only currently-indexable rows (see
    // helpers/fetchIndexableUgcIds.tsx / helpers/seoIndexability.tsx) get a
    // sitemap entry.
    const indexableMockTestIds = await getIndexableMockTestIds();
    const mockTests =
      indexableMockTestIds.size > 0
        ? await db
            .selectFrom("mockTests")
            .where("mockTests.id", "in", Array.from(indexableMockTestIds))
            .select(["mockTests.slug", "mockTests.updatedAt"])
            .execute()
        : [];

    // Add mock test pages
    for (const test of mockTests) {
      if (test.slug) {
        xml += generateUrlEntry({
          loc: `${BASE_URL}/mock-test/${test.slug}`,
          lastmod: toW3CDate(test.updatedAt),
          changefreq: "weekly",
          priority: 0.7,
        });
      }
    }

    // Add teacher pages
    for (const teacher of teachers) {
      xml += generateUrlEntry({
        loc: `${BASE_URL}/expert/${teacher.slug || slugify(teacher.displayName)}`,
        changefreq: "weekly",
        priority: 0.6,
      });
    }

    // Add exam detail pages
    for (const exam of exams) {
      xml += generateUrlEntry({
        loc: `${BASE_URL}/exams/${exam.examSlug}`,
        lastmod: toW3CDate(exam.updatedAt),
        changefreq: "weekly",
        priority: 0.8,
      });
    }

    // Add per-exam product sub-pages — one entry per exam per product type
    // it actually has, per the hide-if-empty rule above.
    for (const exam of exams) {
      xml += generateUrlEntry({
        loc: `${BASE_URL}/exams/${exam.examSlug}/mock-tests`,
        lastmod: toW3CDate(exam.updatedAt),
        changefreq: "weekly",
        priority: 0.7,
      });
    }
    for (const exam of examsWithCourses) {
      xml += generateUrlEntry({
        loc: `${BASE_URL}/exams/${exam.examSlug}/courses`,
        lastmod: toW3CDate(exam.updatedAt),
        changefreq: "weekly",
        priority: 0.6,
      });
    }
    for (const exam of examsWithDigitalProducts) {
      xml += generateUrlEntry({
        loc: `${BASE_URL}/exams/${exam.examSlug}/study-notes`,
        lastmod: toW3CDate(exam.updatedAt),
        changefreq: "weekly",
        priority: 0.6,
      });
    }
    for (const exam of examsWithBundles) {
      xml += generateUrlEntry({
        loc: `${BASE_URL}/exams/${exam.examSlug}/bundles`,
        lastmod: toW3CDate(exam.updatedAt),
        changefreq: "weekly",
        priority: 0.6,
      });
    }

    // Add exam content silo pages (syllabus, exam pattern, eligibility,
    // cutoff, FAQs) — only ones an admin has actually published, mirroring
    // the "only index it if it has real content" rule used for exam pages.
    for (const contentPage of examContentPages) {
      const meta = EXAM_CONTENT_PAGE_META[contentPage.pageType as ExamContentPageType];
      if (!meta) continue;
      xml += generateUrlEntry({
        loc: `${BASE_URL}/exams/${contentPage.examSlug}/${meta.slug}`,
        lastmod: toW3CDate(contentPage.publishedAt),
        changefreq: "monthly",
        priority: 0.6,
      });
    }

    // Add live test pages
    for (const liveTest of liveTests) {
      xml += generateUrlEntry({
        loc: `${BASE_URL}/mock-test/live/${liveTest.id}`,
        lastmod: toW3CDate(liveTest.updatedAt),
        changefreq: "daily",
        priority: 0.7,
      });
    }

    // Add blog and knowledge base pages
    for (const post of blogPosts) {
      const path = post.type === "knowledge_base" ? "help" : "blog";
      xml += generateUrlEntry({
        loc: `${BASE_URL}/${path}/${post.slug}`,
        lastmod: toW3CDate(post.updatedAt),
        changefreq: "weekly",
        priority: 0.6,
      });
    }

    // Study notes — only currently-indexable rows get a sitemap entry.
    const indexableStudyNoteIds = await getIndexableStudyNoteIds();
    const studyNotes =
      indexableStudyNoteIds.size > 0
        ? await db
            .selectFrom("digitalProducts")
            .where("digitalProducts.id", "in", Array.from(indexableStudyNoteIds))
            .select(["digitalProducts.slug", "digitalProducts.updatedAt"])
            .execute()
        : [];

    // Add study note pages
    for (const note of studyNotes) {
      xml += generateUrlEntry({
        loc: `${BASE_URL}/study-notes/${note.slug}`,
        lastmod: toW3CDate(note.updatedAt),
        changefreq: "weekly",
        priority: 0.6,
      });
    }

    // Courses — only currently-indexable rows get a sitemap entry.
    const indexableCourseIds = await getIndexableCourseIds();
    const individualCourses =
      indexableCourseIds.size > 0
        ? await db
            .selectFrom("courses")
            .where("courses.id", "in", Array.from(indexableCourseIds))
            .select(["courses.slug", "courses.updatedAt"])
            .execute()
        : [];

    // Add individual course pages — canonical URL is /course/:slug (the one
    // actually linked from the course listing page and everywhere else in
    // the app); /courses/:courseId is a legacy duplicate route resolving
    // the same slug and is intentionally left out to avoid duplicate-content
    // signals for the same page under two URLs.
    for (const course of individualCourses) {
      xml += generateUrlEntry({
        loc: `${BASE_URL}/course/${course.slug}`,
        lastmod: toW3CDate(course.updatedAt),
        changefreq: "weekly",
        priority: 0.6,
      });
    }

    // Bundles — only currently-indexable rows get a sitemap entry.
    const indexableBundleIds = await getIndexableBundleIds();
    const individualBundles =
      indexableBundleIds.size > 0
        ? await db
            .selectFrom("courseBundles")
            .where("courseBundles.id", "in", Array.from(indexableBundleIds))
            .select(["courseBundles.slug", "courseBundles.updatedAt"])
            .execute()
        : [];

    // Add individual bundle pages
    for (const bundle of individualBundles) {
      xml += generateUrlEntry({
        loc: `${BASE_URL}/bundles/${bundle.slug}`,
        lastmod: toW3CDate(bundle.updatedAt),
        changefreq: "weekly",
        priority: 0.6,
      });
    }

    // Add career posting pages
    for (const posting of careerPostings) {
      xml += generateUrlEntry({
        loc: `${BASE_URL}/careers/${posting.slug}`,
        lastmod: toW3CDate(posting.updatedAt),
        changefreq: "weekly",
        priority: 0.5,
      });
    }

    // Add news coverage pages
    for (const item of newsCoverage) {
      xml += generateUrlEntry({
        loc: `${BASE_URL}/news-and-events/${item.slug}`,
        lastmod: toW3CDate(item.updatedAt),
        changefreq: "monthly",
        priority: 0.5,
      });
    }

    xml += `
</urlset>`;

    return new Response(xml.trim(), {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        // This endpoint scans every published mockTest/digitalProduct/
        // course/courseBundle row (plus join queries) to determine
        // indexability on every call — cheap today, but cost scales with
        // catalog size and this file has no per-row N+1 queries left to
        // optimize away. Caching at the edge (s-maxage) is what keeps it
        // fast as the catalog grows: recomputation only happens once per
        // hour regardless of how often crawlers/tools hit the URL.
        // stale-while-revalidate lets a cache serve the previous (slightly
        // stale) response instantly while regenerating in the background,
        // so no single request ever pays the full recompute cost.
        "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
      },
      status: 200,
    });
  } catch (error) {
    console.error("Failed to generate sitemap:", error);
    const message =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(`Error generating sitemap: ${message}`, {
      status: 500,
      headers: {
        "Content-Type": "text/plain",
      },
    });
  }
}