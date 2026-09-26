import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./bulk_POST.schema";
import superjson from "superjson";
import { getProductPublishIssues, formatPublishIssues } from "../../../helpers/digitalProductRules";
import { findStudyNoteFileProblem } from "../../../helpers/studyNoteFileCheck";
import { pendingReviewIds, queueContentReview } from "../../../helpers/contentReviewQueue";
import { sendReviewChatAlert, type QueuedReview } from "../../../helpers/reviewChatAlert";

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

    const products = await db
      .selectFrom("digitalProducts")
      .select(["id", "teacherId", "pdfUrl", "price", "title", "description", "status"])
      .where("id", "in", input.ids)
      .where("teacherId", "=", effectiveTeacherId)
      .execute();

    const foundIds = new Set(products.map((p) => p.id));
    const succeeded: number[] = [];
    const failed: OutputType["failed"] = [];

    for (const id of input.ids) {
      if (!foundIds.has(id)) {
        failed.push({ id, reason: "Not found, or it is not yours" });
      }
    }

    if (input.action === "publish") {
      const candidateIds = products.filter((p) => p.status !== "published").map((p) => p.id);
      const fileRows = candidateIds.length > 0
        ? await db
            .selectFrom("digitalProductFiles")
            .select(["productId", "title", "fileUrl", "pageCount"])
            .where("productId", "in", candidateIds)
            .execute()
        : [];
      const needsReview = user.role !== "admin";
      const alreadyInReview = needsReview
        ? await pendingReviewIds(db, "digital_product", candidateIds)
        : new Set<number>();
      for (const p of products) {
        if (p.status === "published") {
          failed.push({ id: p.id, title: p.title, reason: "Already published" });
          continue;
        }
        if (alreadyInReview.has(p.id)) {
          failed.push({ id: p.id, title: p.title, reason: "Already waiting for review" });
          continue;
        }
        const productFiles = fileRows.filter((f) => f.productId === p.id);
        const issues = getProductPublishIssues({
          ...p,
          fileUrls: productFiles.map((f) => f.fileUrl),
          filePageCounts: productFiles.map((f) => f.pageCount),
        });
        if (issues.length > 0) {
          failed.push({ id: p.id, title: p.title, reason: formatPublishIssues(issues) });
          continue;
        }
        const fileProblems = await Promise.all(
          (productFiles.length > 0 ? productFiles : [{ title: p.title, fileUrl: p.pdfUrl }]).map(findStudyNoteFileProblem)
        );
        const fileProblem = fileProblems.find((problem): problem is string => !!problem);
        if (fileProblem) {
          failed.push({ id: p.id, title: p.title, reason: fileProblem });
          continue;
        }
        succeeded.push(p.id);
      }
      if (succeeded.length > 0 && needsReview) {
        const queued: QueuedReview[] = [];
        for (const p of products.filter((row) => succeeded.includes(row.id))) {
          const review: QueuedReview = { contentType: "digital_product", contentId: p.id, teacherId: p.teacherId };
          if (await queueContentReview(db, review)) queued.push(review);
        }
        await sendReviewChatAlert(queued);
      } else if (succeeded.length > 0) {
        await db
          .updateTable("digitalProducts")
          .set({ status: "published", isPublished: true, publishedAt: new Date() })
          .where("id", "in", succeeded)
          .execute();
      }
    } else if (input.action === "unpublish") {
      for (const p of products) succeeded.push(p.id);
      if (succeeded.length > 0) {
        await db
          .updateTable("digitalProducts")
          .set({ status: "draft", isPublished: false, updatedAt: new Date() })
          .where("id", "in", succeeded)
          .execute();
        await db
          .deleteFrom("cartItems")
          .where("digitalProductId", "in", succeeded)
          .execute();
      }
    } else {
      // archive
      for (const p of products) {
        succeeded.push(p.id);
      }
      if (succeeded.length > 0) {
        await db
          .updateTable("digitalProducts")
          .set({ status: "archived", isPublished: false, updatedAt: new Date() })
          .where("id", "in", succeeded)
          .execute();
      }
    }

    const output: OutputType = { succeeded, failed };

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error running bulk action on digital products:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: "Failed to run bulk action", details: errorMessage }),
      { status: 500 }
    );
  }
}
