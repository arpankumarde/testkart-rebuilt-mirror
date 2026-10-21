import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./publish_POST.schema";
import superjson from "superjson";
import { getProductPublishIssues, formatPublishIssues, ProductRuleError } from "../../../helpers/digitalProductRules";
import { assertStudyNoteFilesArePdfs } from "../../../helpers/studyNoteFileCheck";
import {
  REVIEW_QUEUED_NOTE,
  alreadyInReviewMessage,
  hasPendingReview,
  publishesWithoutReview,
  queueContentReview,
} from "../../../helpers/contentReviewQueue";

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);

    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "Unauthorized" }),
        { status: 403 }
      );
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const product = await db
      .selectFrom("digitalProducts")
      .select(["id", "teacherId", "pdfUrl", "price", "title", "description", "status", "visibility"])
      .where("id", "=", input.id)
      .where("teacherId", "=", effectiveTeacherId)
      .executeTakeFirst();

    if (!product) {
      return new Response(
        superjson.stringify({ error: "Product not found or unauthorized" }),
        { status: 404 }
      );
    }

    if (product.status === "published") {
      return new Response(
        superjson.stringify({ error: "Product is already published" }),
        { status: 400 }
      );
    }

    // Unlisted study notes skip review and go live at once (helpers/contentVisibility).
    const unlisted = product.visibility === "unlisted";
    const needsReview = !unlisted && !(await publishesWithoutReview(db, user.role, product.teacherId));
    if (user.role !== "admin" && (await hasPendingReview(db, "digital_product", input.id))) {
      return new Response(
        superjson.stringify({ error: alreadyInReviewMessage("study note") }),
        { status: 400 }
      );
    }

    const files = await db
      .selectFrom("digitalProductFiles")
      .select(["title", "fileUrl", "pageCount"])
      .where("productId", "=", input.id)
      .orderBy("orderIndex", "asc")
      .orderBy("id", "asc")
      .execute();

    const issues = getProductPublishIssues({
      ...product,
      fileUrls: files.map((f) => f.fileUrl),
      filePageCounts: files.map((f) => f.pageCount),
      fileTitles: files.map((f) => f.title),
    });
    if (issues.length > 0) {
      return new Response(
        superjson.stringify({ error: `Cannot publish yet. ${formatPublishIssues(issues)}.` }),
        { status: 400 }
      );
    }

    await assertStudyNoteFilesArePdfs(
      files.length > 0 ? files : [{ title: product.title, fileUrl: product.pdfUrl }]
    );

    if (needsReview) {
      await queueContentReview(db, { contentType: "digital_product", contentId: input.id, teacherId: product.teacherId });
      console.log(`Digital product ${input.id} submitted for review by teacher ${product.teacherId}`);
      const output: OutputType = {
        success: true,
        published: false,
        message: `Your study note has been submitted for review. ${REVIEW_QUEUED_NOTE}`,
      };
      return new Response(superjson.stringify(output));
    }

    await db
      .updateTable("digitalProducts")
      .set({
        status: "published",
        isPublished: true,
        publishedAt: new Date(),
      })
      .where("id", "=", input.id)
      .execute();

    console.log(`Digital product ${input.id} published without review by ${user.role} ${user.id}`);

    const output: OutputType = {
      success: true,
      published: true,
      message: unlisted
        ? "Your study note is live as unlisted. Anyone with its link can open and buy it; it stays out of search and listings."
        : "Your study note is live. Students can find and buy it now.",
    };

    return new Response(superjson.stringify(output));
  } catch (error) {
    if (error instanceof ProductRuleError) {
      return new Response(
        superjson.stringify({ error: `Cannot publish yet. ${error.message}` }),
        { status: 400 }
      );
    }
    console.error("Error publishing digital product:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: "Failed to publish product", details: errorMessage }),
      { status: 500 }
    );
  }
}