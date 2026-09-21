import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, OutputType } from "./publish_POST.schema";
import superjson from "superjson";
import { mapExamContentRow, EXAM_CONTENT_SELECT_COLUMNS } from "../../../helpers/examContentMapper";

// Publishing is the one deliberate "review complete" action - it copies the
// working draft into the published_* snapshot actually served on the public
// site and clears the ready-for-review mark. Nothing else copies the draft into
// published_* (unpublish only empties them), so an AI regeneration or a manual
// draft edit can never silently change what's already live.
export async function handle(request: Request) {
  try {
    const admin = await getAdminServerSessionOrThrow(request);

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const existing = await db
      .selectFrom("examContentPages")
      .selectAll()
      .where("examId", "=", input.examId)
      .where("pageType", "=", input.pageType)
      .executeTakeFirst();

    if (!existing) {
      return new Response(
        superjson.stringify({ error: "Nothing to publish - save or generate a draft first." }),
        { status: 400 }
      );
    }

    // Neither body content nor FAQs is mandatory on its own - a section is
    // publishable once it has at least one of the two, so an admin is never
    // forced to write FAQs (or body content) just to get something live.
    const hasContent =
      (!!existing.content && existing.content.trim().length > 0) ||
      (Array.isArray(existing.faqItems) && existing.faqItems.length > 0);

    if (!existing.title.trim() || !hasContent) {
      return new Response(
        superjson.stringify({ error: "Draft is missing a title or content - nothing to publish." }),
        { status: 400 }
      );
    }

    const updated = await db
      .updateTable("examContentPages")
      .set({
        status: "published",
        publishedTitle: existing.title,
        publishedSeoTitle: existing.seoTitle,
        publishedSeoDescription: existing.seoDescription,
        publishedDescription: existing.description,
        publishedContent: existing.content,
        publishedFaqItems: existing.faqItems,
        publishedAt: new Date(),
        reviewedByAdminId: admin.id,
        reviewedAt: new Date(),
        readyForReviewAt: null,
        readyForReviewByAdminId: null,
      })
      .where("id", "=", existing.id)
      .returningAll()
      .executeTakeFirstOrThrow();

    const withReviewer = await db
      .selectFrom("examContentPages")
      .leftJoin("admins", "examContentPages.reviewedByAdminId", "admins.id")
      .leftJoin(
        "admins as readyForReviewAdmins",
        "examContentPages.readyForReviewByAdminId",
        "readyForReviewAdmins.id"
      )
      .select(EXAM_CONTENT_SELECT_COLUMNS)
      .where("examContentPages.id", "=", updated.id)
      .executeTakeFirstOrThrow();

    return new Response(
      superjson.stringify({ page: mapExamContentRow(withReviewer) } satisfies OutputType)
    );
  } catch (error) {
    console.error("[admin/exam-content/publish_POST] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}