import { db } from "./db";
import { sql } from "kysely";
import {
  computeMockTestSeo,
  computeStudyNoteSeo,
  computeCourseSeo,
  computeBundleSeo,
  isMeaningfulSubjectName,
} from "./seoIndexability";

// Shared by sitemap_GET.ts and sitemap-media_GET.ts so both XML sitemaps
// use the exact same indexability determination — the spec requires every
// sitemap to contain only currently-indexable UGC URLs, and having two
// separate implementations of the same rule set would risk them drifting
// apart. Each function fetches its own candidate rows + the content-volume
// signals seoIndexability.tsx needs, batches the duplicate-title check into
// one GROUP BY query instead of one COUNT query per row, then returns the
// set of ids that passed. Callers do their own lightweight follow-up query
// (WHERE id IN (...)) for whatever display fields they need.

async function buildDuplicateTitleMap(
  tableName: "mockTests" | "digitalProducts" | "courses" | "courseBundles",
  publishedColumn: string,
  publishedValue: boolean | string
): Promise<Map<string, number>> {
  const rows = await db
    .selectFrom(tableName)
    .select([
      sql<string>`lower(trim(${sql.ref(`${tableName}.title`)}))`.as("normTitle"),
      (eb) => eb.fn.count<number>(`${tableName}.id` as any).as("cnt"),
    ])
    .where(`${tableName}.${publishedColumn}` as any, "=", publishedValue as any)
    .groupBy(sql`lower(trim(${sql.ref(`${tableName}.title`)}))`)
    .having((eb) => eb.fn.count(`${tableName}.id` as any), ">", 1)
    .execute();
  return new Map(rows.map((r) => [r.normTitle, Number(r.cnt)]));
}

function dupCountFor(map: Map<string, number>, title: string): number {
  const key = title.trim().toLowerCase();
  const groupSize = map.get(key) ?? 0;
  return Math.max(0, groupSize - 1);
}

export async function getIndexableMockTestIds(): Promise<Set<number>> {
  const candidates = await db
    .selectFrom("mockTests")
    .where("mockTests.isPublished", "=", true)
    .where("mockTests.deletedAt", "is", null)
    .where((eb) =>
      eb.not(
        eb.exists(
          eb.selectFrom('liveTests')
            .select('liveTests.id')
            .whereRef('liveTests.mockTestId', '=', 'mockTests.id')
        )
      )
    )
    .select([
      "mockTests.id",
      "mockTests.title",
      "mockTests.description",
      "mockTests.longDescription",
      "mockTests.isPublished",
      "mockTests.deletedAt",
      "mockTests.examId",
      "mockTests.totalQuestions",
      "mockTests.thumbnailUrl",
      "mockTests.introVideoUrl",
      "mockTests.whatYouLearn",
      "mockTests.requirements",
    ])
    .execute();
  // mockTests.subject is dead data in practice (every row is the literal
  // string "[]") — the real subject/topic tagging lives on
  // testItemSubjects.subjectName, one level down via mockTestItems. Batch
  // that into one query instead of the per-package join
  // tests/details_GET.ts gets "for free" from data it already fetches.
  const subjectRows = await db
    .selectFrom("testItemSubjects")
    .innerJoin("mockTestItems", "mockTestItems.id", "testItemSubjects.testItemId")
    .select(["mockTestItems.packageId", "testItemSubjects.subjectName"])
    .where("mockTestItems.packageId", "in", candidates.length > 0 ? candidates.map((t) => t.id) : [-1])
    .execute();
  const packagesWithSubjectTagging = new Set(
    subjectRows.filter((r) => isMeaningfulSubjectName(r.subjectName)).map((r) => r.packageId)
  );
  const dupMap = await buildDuplicateTitleMap("mockTests", "isPublished", true);
  const results = await Promise.all(
    candidates.map((t) =>
      computeMockTestSeo(
        null,
        { ...t, hasSubjectTagging: packagesWithSubjectTagging.has(t.id) },
        dupCountFor(dupMap, t.title)
      )
    )
  );
  return new Set(candidates.filter((_, i) => results[i].indexable).map((t) => t.id));
}

export async function getIndexableStudyNoteIds(): Promise<Set<number>> {
  const candidates = await db
    .selectFrom("digitalProducts")
    .where("digitalProducts.status", "=", "published")
    .where("digitalProducts.isPublished", "=", true)
    .select([
      "digitalProducts.id",
      "digitalProducts.title",
      "digitalProducts.description",
      "digitalProducts.shortDescription",
      "digitalProducts.status",
      "digitalProducts.examId",
      "digitalProducts.category",
      "digitalProducts.pageCount",
      "digitalProducts.thumbnailUrl",
      "digitalProducts.tags",
      "digitalProducts.language",
    ])
    .execute();
  const fileAggregates = await db
    .selectFrom("digitalProductFiles")
    .select([
      "productId",
      (eb) => eb.fn.count<number>("id").as("fileCount"),
      (eb) => eb.fn.sum<number>("pageCount").as("pageSum"),
    ])
    .where("productId", "in", candidates.length > 0 ? candidates.map((p) => p.id) : [-1])
    .groupBy("productId")
    .execute();
  const fileMap = new Map(
    fileAggregates.map((r) => [r.productId, { fileCount: Number(r.fileCount), pageSum: Number(r.pageSum ?? 0) }])
  );
  const dupMap = await buildDuplicateTitleMap("digitalProducts", "status", "published");
  const results = await Promise.all(
    candidates.map((p) => {
      const agg = fileMap.get(p.id);
      const fileCount = agg?.fileCount ?? 0;
      const actualPageCount = fileCount > 0 ? agg!.pageSum : (p.pageCount ?? 0);
      return computeStudyNoteSeo(
        null,
        {
          id: p.id,
          title: p.title,
          description: p.description,
          shortDescription: p.shortDescription,
          status: p.status,
          examId: p.examId,
          category: p.category,
          actualPageCount,
          fileCount,
          thumbnailUrl: p.thumbnailUrl,
          tags: p.tags,
          language: p.language,
        },
        dupCountFor(dupMap, p.title)
      );
    })
  );
  return new Set(candidates.filter((_, i) => results[i].indexable).map((p) => p.id));
}

export async function getIndexableCourseIds(): Promise<Set<number>> {
  const candidates = await db
    .selectFrom("courses")
    .where("courses.status", "=", "published")
    .select([
      "courses.id",
      "courses.title",
      "courses.description",
      "courses.status",
      "courses.examId",
      "courses.category",
      "courses.thumbnailUrl",
      "courses.introVideoUrl",
      "courses.estimatedDurationMinutes",
    ])
    .execute();
  const lessonAggregates = await db
    .selectFrom("courseLessons")
    .innerJoin("courseSections", "courseSections.id", "courseLessons.sectionId")
    .select([
      "courseSections.courseId",
      (eb) => eb.fn.count<number>("courseLessons.id").as("totalLessons"),
      (eb) =>
        eb.fn
          .count<number>("courseLessons.id")
          .filterWhere("courseLessons.contentType", "=", "video")
          .as("videoLessons"),
      (eb) =>
        eb.fn
          .count<number>("courseLessons.id")
          .filterWhere(sql`trim(coalesce(course_lessons.description, ''))`, "!=", "")
          .as("lessonsWithDescription"),
    ])
    .where("courseSections.courseId", "in", candidates.length > 0 ? candidates.map((c) => c.id) : [-1])
    .groupBy("courseSections.courseId")
    .execute();
  const lessonMap = new Map(
    lessonAggregates.map((r) => [
      r.courseId,
      {
        totalLessons: Number(r.totalLessons),
        videoLessons: Number(r.videoLessons),
        lessonsWithDescription: Number(r.lessonsWithDescription),
      },
    ])
  );
  const dupMap = await buildDuplicateTitleMap("courses", "status", "published");
  const results = await Promise.all(
    candidates.map((c) => {
      const agg = lessonMap.get(c.id);
      const totalLessons = agg?.totalLessons ?? 0;
      const videoLessons = agg?.videoLessons ?? 0;
      const lessonsWithDescriptionRatio = totalLessons > 0 ? agg!.lessonsWithDescription / totalLessons : 0;
      return computeCourseSeo(
        null,
        {
          id: c.id,
          title: c.title,
          description: c.description,
          status: c.status,
          examId: c.examId,
          category: c.category,
          totalLessons,
          videoLessons,
          lessonsWithDescriptionRatio,
          thumbnailUrl: c.thumbnailUrl,
          introVideoUrl: c.introVideoUrl,
          estimatedDurationMinutes: c.estimatedDurationMinutes,
        },
        dupCountFor(dupMap, c.title)
      );
    })
  );
  return new Set(candidates.filter((_, i) => results[i].indexable).map((c) => c.id));
}

export async function getIndexableBundleIds(): Promise<Set<number>> {
  const candidates = await db
    .selectFrom("courseBundles")
    .where("courseBundles.isPublished", "=", true)
    .select([
      "courseBundles.id",
      "courseBundles.title",
      "courseBundles.description",
      "courseBundles.isPublished",
      "courseBundles.discountPercentage",
      "courseBundles.thumbnailUrl",
      "courseBundles.introVideoUrl",
    ])
    .execute();
  const bundleIds = candidates.length > 0 ? candidates.map((b) => b.id) : [-1];
  const itemRows = await db
    .selectFrom("courseBundleItems")
    .leftJoin("courses", (join) =>
      join.onRef("courses.id", "=", "courseBundleItems.courseId").on("courseBundleItems.itemType", "=", "course")
    )
    .leftJoin("digitalProducts", (join) =>
      join
        .onRef("digitalProducts.id", "=", "courseBundleItems.digitalProductId")
        .on("courseBundleItems.itemType", "=", "digital_product")
    )
    .leftJoin("mockTests", (join) =>
      join.onRef("mockTests.id", "=", "courseBundleItems.mockTestId").on("courseBundleItems.itemType", "=", "test")
    )
    .select([
      "courseBundleItems.bundleId",
      "courseBundleItems.itemType",
      "courses.status as courseStatus",
      "digitalProducts.status as digitalProductStatus",
      "mockTests.isPublished as testIsPublished",
    ])
    .where("courseBundleItems.bundleId", "in", bundleIds)
    .execute();
  const itemMap = new Map<number, { itemCount: number; publishedItemCount: number; itemTypes: Set<string> }>();
  for (const row of itemRows) {
    const entry = itemMap.get(row.bundleId) ?? { itemCount: 0, publishedItemCount: 0, itemTypes: new Set<string>() };
    entry.itemCount += 1;
    entry.itemTypes.add(row.itemType);
    const isItemPublished =
      (row.itemType === "course" && row.courseStatus === "published") ||
      (row.itemType === "digital_product" && row.digitalProductStatus === "published") ||
      (row.itemType === "test" && row.testIsPublished === true);
    if (isItemPublished) entry.publishedItemCount += 1;
    itemMap.set(row.bundleId, entry);
  }
  const dupMap = await buildDuplicateTitleMap("courseBundles", "isPublished", true);
  const results = await Promise.all(
    candidates.map((b) => {
      const agg = itemMap.get(b.id) ?? { itemCount: 0, publishedItemCount: 0, itemTypes: new Set<string>() };
      return computeBundleSeo(
        null,
        {
          id: b.id,
          title: b.title,
          description: b.description,
          isPublished: b.isPublished,
          itemCount: agg.itemCount,
          publishedItemCount: agg.publishedItemCount,
          distinctItemTypeCount: agg.itemTypes.size,
          discountPercentage: b.discountPercentage ? Number(b.discountPercentage) : null,
          thumbnailUrl: b.thumbnailUrl,
          introVideoUrl: b.introVideoUrl,
        },
        dupCountFor(dupMap, b.title)
      );
    })
  );
  return new Set(candidates.filter((_, i) => results[i].indexable).map((b) => b.id));
}
