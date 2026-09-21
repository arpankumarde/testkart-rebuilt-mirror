import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { hasPendingReview } from "../../../helpers/contentReviewQueue";
import {
  schema,
  PreviewBody,
  PreviewFact,
  PreviewReview,
  PreviewStatus,
  PreviewTestItem,
  PreviewBundleItem,
} from "./details_GET.schema";

/*
 * Read-only, admin-only view of one teacher item in any state (draft,
 * unpublished, archived, trashed) with everything a student would get after
 * buying it. Nothing here counts a view or touches student data.
 */

const rupees = (value: unknown) => `Rs ${Number(value ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const fact = (label: string, value: unknown): PreviewFact | null => {
  if (value === null || value === undefined || value === "") return null;
  return { label, value: String(value) };
};

const facts = (...items: (PreviewFact | null)[]): PreviewFact[] => items.filter((f): f is PreviewFact => f !== null);

// what_you_learn is stored as a jsonb array, a JSON string of one, or a doubly encoded string.
function toStringList(value: unknown): string[] {
  let parsed: unknown = value;
  for (let depth = 0; depth < 2 && typeof parsed === "string"; depth++) {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return typeof value === "string" && value.trim() ? [value] : [];
    }
  }
  return Array.isArray(parsed) ? parsed.map((item) => String(item ?? "").trim()).filter(Boolean) : [];
}

function toPrizeTiers(value: unknown): PreviewFact[] {
  let parsed: unknown = value;
  for (let depth = 0; depth < 2 && typeof parsed === "string"; depth++) {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((tier) => {
    if (!tier || typeof tier !== "object") return [];
    const { rankFrom, rankTo, amountPerRank } = tier as Record<string, unknown>;
    if (rankFrom == null || amountPerRank == null) return [];
    const ranks = rankTo != null && Number(rankTo) !== Number(rankFrom) ? `Rank ${rankFrom} to ${rankTo}` : `Rank ${rankFrom}`;
    return [{ label: ranks, value: `${rupees(amountPerRank)} each` }];
  });
}

const notFound = () => new Response(superjson.stringify({ error: "This item no longer exists" }), { status: 404 });

async function loadTeacher(teacherId: number) {
  const teacher = await db
    .selectFrom("users")
    .select(["id", "displayName", "email"])
    .where("id", "=", teacherId)
    .executeTakeFirst();
  return { id: teacherId, name: teacher?.displayName ?? "Unknown teacher", email: teacher?.email ?? null };
}

async function loadTestItems(packageId: number): Promise<PreviewTestItem[]> {
  const items = await db
    .selectFrom("mockTestItems")
    .select([
      "id",
      "title",
      "description",
      "durationMinutes",
      "isFree",
      "deletedAt",
      "scheduledDate",
      "orderIndex",
    ])
    .select((eb) =>
      eb
        .selectFrom("testQuestions")
        .whereRef("testQuestions.testId", "=", "mockTestItems.id")
        .select(eb.fn.countAll<string>().as("cnt"))
        .as("questionCount")
    )
    .where("packageId", "=", packageId)
    .orderBy("orderIndex", "asc")
    .orderBy("id", "asc")
    .execute();
  if (items.length === 0) return [];

  const subjects = await db
    .selectFrom("testItemSubjects")
    .select(["testItemId", "subjectName"])
    .where(
      "testItemId",
      "in",
      items.map((item) => item.id)
    )
    .orderBy("orderIndex", "asc")
    .execute();

  return items.map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    durationMinutes: item.durationMinutes,
    isFree: item.isFree,
    isTrashed: item.deletedAt !== null,
    scheduledDate: item.scheduledDate,
    questionCount: Number(item.questionCount ?? 0),
    subjects: subjects.filter((s) => s.testItemId === item.id).map((s) => s.subjectName),
  }));
}

const seriesStatus = (row: { deletedAt: Date | null; isPublished: boolean; wasEverPublished: boolean }): PreviewStatus =>
  row.deletedAt ? "trashed" : row.isPublished ? "published" : row.wasEverPublished ? "unpublished" : "draft";

const catalogueStatus = (status: string | null): PreviewStatus =>
  status === "published" ? "published" : status === "archived" ? "archived" : "draft";

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request);
  } catch {
    return new Response(superjson.stringify({ error: "Not authenticated" }), { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const parsed = schema.safeParse({ type: url.searchParams.get("type"), id: url.searchParams.get("id") });
    if (!parsed.success) {
      return new Response(superjson.stringify({ error: "Invalid content type or id" }), { status: 400 });
    }
    const { type, id } = parsed.data;
    const inReview = await hasPendingReview(db, type, id);
    const review = await db
      .selectFrom("contentReviews")
      .select(["status", "adminNotes", "reviewedAt"])
      .where("contentType", "=", type)
      .where("contentId", "=", id)
      .where("status", "!=", "pending")
      .orderBy("updatedAt", "desc")
      .orderBy("id", "desc")
      .executeTakeFirst();
    const lastReview: PreviewReview | null = review
      ? { status: review.status === "approved" ? "approved" : "rejected", notes: review.adminNotes, reviewedAt: review.reviewedAt }
      : null;
    let output: PreviewBody;

    switch (type) {
      case "mock_test": {
        const row = await db.selectFrom("mockTests").selectAll().where("id", "=", id).executeTakeFirst();
        if (!row) return notFound();
        output = {
          type,
          id: row.id,
          title: row.title,
          slug: row.slug,
          status: seriesStatus(row),
          inReview,
          teacher: await loadTeacher(row.teacherId),
          thumbnailUrl: row.thumbnailUrl,
          introVideoUrl: row.introVideoUrl,
          description: row.description,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          publishedAt: null,
          longDescription: row.longDescription,
          whatYouLearn: toStringList(row.whatYouLearn),
          facts: facts(
            fact("Exam", row.examName),
            fact("Subject", row.subject),
            fact("Language", row.language),
            fact("Price", row.isFree ? "Free" : rupees(row.price)),
            row.discountPrice != null && !row.isFree ? fact("Discount price", rupees(row.discountPrice)) : null,
            fact("Free tests", row.freeTestsCount),
            fact("Students enrolled", row.studentsEnrolled),
            fact("Requirements", toStringList(row.requirements).join("; ") || null),
          ),
          tests: await loadTestItems(row.id),
        };
        break;
      }

      case "course": {
        const row = await db.selectFrom("courses").selectAll().where("id", "=", id).executeTakeFirst();
        if (!row) return notFound();
        const sections = await db
          .selectFrom("courseSections")
          .select(["id", "title", "description"])
          .where("courseId", "=", row.id)
          .orderBy("orderIndex", "asc")
          .orderBy("id", "asc")
          .execute();
        const lessons =
          sections.length === 0
            ? []
            : await db
                .selectFrom("courseLessons")
                .select([
                  "id",
                  "sectionId",
                  "title",
                  "description",
                  "contentType",
                  "contentUrl",
                  "textContent",
                  "durationMinutes",
                  "isPreview",
                  "gumletStatus",
                ])
                .where(
                  "sectionId",
                  "in",
                  sections.map((s) => s.id)
                )
                .orderBy("orderIndex", "asc")
                .orderBy("id", "asc")
                .execute();
        output = {
          type,
          id: row.id,
          title: row.title,
          slug: row.slug,
          status: catalogueStatus(row.status),
          inReview,
          teacher: await loadTeacher(row.teacherId),
          thumbnailUrl: row.thumbnailUrl ?? row.thumbnailImageUrl,
          introVideoUrl: row.introVideoUrl,
          description: row.description,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          publishedAt: row.publishedAt,
          facts: facts(
            fact("Exam", row.examName),
            fact("Category", row.category),
            fact("Level", row.level),
            fact("Language", row.language),
            fact("Price", Number(row.price) > 0 ? rupees(row.price) : "Free"),
            row.estimatedDurationMinutes ? fact("Estimated duration", `${row.estimatedDurationMinutes} min`) : null,
            fact("Lessons", lessons.length),
          ),
          sections: sections.map((section) => ({
            ...section,
            lessons: lessons
              .filter((lesson) => lesson.sectionId === section.id)
              .map(({ sectionId, ...lesson }) => ({ ...lesson, gumletStatus: lesson.gumletStatus ?? null })),
          })),
        };
        break;
      }

      case "digital_product": {
        const row = await db.selectFrom("digitalProducts").selectAll().where("id", "=", id).executeTakeFirst();
        if (!row) return notFound();
        const fileRows = await db
          .selectFrom("digitalProductFiles")
          .select(["id", "title", "fileUrl", "pageCount", "fileSizeBytes"])
          .where("productId", "=", row.id)
          .orderBy("orderIndex", "asc")
          .orderBy("id", "asc")
          .execute();
        let files = fileRows.map((f) => ({
          ...f,
          fileSizeBytes: f.fileSizeBytes != null ? Number(f.fileSizeBytes) : null,
        }));
        // Products from before multi-file notes keep their one file on pdfUrl.
        if (files.length === 0 && row.pdfUrl && !row.pdfUrl.includes("placeholder")) {
          files = [
            {
              id: 0,
              title: row.title,
              fileUrl: row.pdfUrl,
              pageCount: row.pageCount,
              fileSizeBytes: row.fileSizeBytes != null ? Number(row.fileSizeBytes) : null,
            },
          ];
        }
        output = {
          type,
          id: row.id,
          title: row.title,
          slug: row.slug,
          status: catalogueStatus(row.status),
          inReview,
          teacher: await loadTeacher(row.teacherId),
          thumbnailUrl: row.thumbnailUrl,
          introVideoUrl: null,
          description: row.description,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          publishedAt: row.publishedAt,
          shortDescription: row.shortDescription,
          facts: facts(
            fact("Exam", row.examName),
            fact("Category", row.category),
            fact("Language", row.language),
            fact("Price", Number(row.price) > 0 ? rupees(row.price) : "Free"),
            fact("Free preview pages", row.previewPages),
            fact("Tags", row.tags?.length ? row.tags.join(", ") : null),
            fact("Purchases", row.totalPurchases),
          ),
          files,
        };
        break;
      }

      case "course_bundle": {
        const row = await db.selectFrom("courseBundles").selectAll().where("id", "=", id).executeTakeFirst();
        if (!row) return notFound();
        const itemRows = await db
          .selectFrom("courseBundleItems")
          .leftJoin("courses", "courses.id", "courseBundleItems.courseId")
          .leftJoin("digitalProducts", "digitalProducts.id", "courseBundleItems.digitalProductId")
          .leftJoin("mockTests", "mockTests.id", "courseBundleItems.mockTestId")
          .select([
            "courseBundleItems.itemType",
            "courses.id as courseId",
            "courses.title as courseTitle",
            "courses.status as courseStatus",
            "courses.price as coursePrice",
            "digitalProducts.id as productId",
            "digitalProducts.title as productTitle",
            "digitalProducts.status as productStatus",
            "digitalProducts.price as productPrice",
            "mockTests.id as seriesId",
            "mockTests.title as seriesTitle",
            "mockTests.isPublished as seriesIsPublished",
            "mockTests.wasEverPublished as seriesWasEverPublished",
            "mockTests.deletedAt as seriesDeletedAt",
            "mockTests.price as seriesPrice",
          ])
          .where("courseBundleItems.bundleId", "=", row.id)
          .orderBy("courseBundleItems.orderIndex", "asc")
          .orderBy("courseBundleItems.id", "asc")
          .execute();
        const items: PreviewBundleItem[] = itemRows.flatMap((item): PreviewBundleItem[] => {
          if (item.itemType === "course" && item.courseId != null) {
            return [{ type: "course", id: item.courseId, title: item.courseTitle ?? "", status: catalogueStatus(item.courseStatus), price: Number(item.coursePrice ?? 0) }];
          }
          if (item.itemType === "digital_product" && item.productId != null) {
            return [{ type: "digital_product", id: item.productId, title: item.productTitle ?? "", status: catalogueStatus(item.productStatus), price: Number(item.productPrice ?? 0) }];
          }
          if (item.itemType === "test" && item.seriesId != null) {
            return [{
              type: "mock_test",
              id: item.seriesId,
              title: item.seriesTitle ?? "",
              status: seriesStatus({
                deletedAt: item.seriesDeletedAt ?? null,
                isPublished: !!item.seriesIsPublished,
                wasEverPublished: !!item.seriesWasEverPublished,
              }),
              price: Number(item.seriesPrice ?? 0),
            }];
          }
          return [];
        });
        output = {
          type,
          id: row.id,
          title: row.title,
          slug: row.slug,
          status: row.isPublished ? "published" : row.publishedAt ? "unpublished" : "draft",
          inReview,
          teacher: await loadTeacher(row.teacherId),
          thumbnailUrl: row.thumbnailUrl,
          introVideoUrl: row.introVideoUrl,
          description: row.description,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          publishedAt: row.publishedAt,
          facts: facts(
            fact("Price", rupees(row.price)),
            fact("Original price", rupees(row.originalPrice)),
            row.discountPercentage != null ? fact("Discount", `${Number(row.discountPercentage).toFixed(0)}%`) : null,
            fact("Items", items.length),
          ),
          items,
        };
        break;
      }

      case "live_test": {
        const row = await db.selectFrom("liveTests").selectAll().where("id", "=", id).executeTakeFirst();
        if (!row) return notFound();
        output = {
          type,
          id: row.id,
          title: row.title,
          slug: null,
          status: row.isActive ? "published" : "draft",
          inReview,
          teacher: await loadTeacher(row.teacherId),
          thumbnailUrl: row.thumbnailUrl,
          introVideoUrl: row.introVideoUrl,
          description: row.description,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          publishedAt: null,
          mockTestId: row.mockTestId,
          startTime: row.startTime,
          endTime: row.endTime,
          registrationDeadline: row.registrationDeadline,
          facts: facts(
            fact("Entry", row.isFree ? "Free" : rupees(row.price)),
            row.discountPrice != null && !row.isFree ? fact("Discount price", rupees(row.discountPrice)) : null,
            fact("Seats", row.maxSeats),
            fact("Registered", row.enrolledCount),
            row.hasPrizes ? fact("Prize pool", rupees(row.totalPrizePool)) : fact("Prizes", "None"),
            row.hasPrizes ? fact("Prize funding", row.prizeFundSource) : null,
          ),
          prizeTiers: row.hasPrizes ? toPrizeTiers(row.prizeTiers) : [],
          tests: await loadTestItems(row.mockTestId),
        };
        break;
      }
    }

    return new Response(superjson.stringify({ ...output, lastReview }));
  } catch (error) {
    console.error("Error loading admin content preview:", error);
    return new Response(superjson.stringify({ error: "Could not load this item" }), { status: 500 });
  }
}