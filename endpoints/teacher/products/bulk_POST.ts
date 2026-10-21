import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./bulk_POST.schema";
import superjson from "superjson";
import { getProductPublishIssues, formatPublishIssues } from "../../../helpers/digitalProductRules";
import { findStudyNoteFileProblem } from "../../../helpers/studyNoteFileCheck";
import { pendingReviewIds, publishesWithoutReview, queueContentReview } from "../../../helpers/contentReviewQueue";
import {
  bundleConfirmationResponse,
  findPublishedBundlesContaining,
  unpublishBundles,
  type AffectedBundle,
} from "../../../helpers/bundleDependencies";

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
      .select(["id", "teacherId", "pdfUrl", "price", "title", "description", "status", "visibility"])
      .where("id", "in", input.ids)
      .where("teacherId", "=", effectiveTeacherId)
      .execute();

    const foundIds = new Set(products.map((p) => p.id));
    const succeeded: number[] = [];
    const failed: OutputType["failed"] = [];
    let unpublishedBundles: AffectedBundle[] = [];
    let needsReview = true;

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
            .orderBy("orderIndex", "asc")
            .orderBy("id", "asc")
            .execute()
        : [];
      needsReview = !(await publishesWithoutReview(db, user.role, effectiveTeacherId));
      const alreadyInReview = user.role !== "admin"
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
          fileTitles: productFiles.map((f) => f.title),
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
      // Unlisted study notes skip review and go live at once (helpers/contentVisibility).
      const unlistedIds = new Set(products.filter((p) => p.visibility === "unlisted").map((p) => p.id));
      const reviewIds = needsReview ? succeeded.filter((id) => !unlistedIds.has(id)) : [];
      const goLiveIds = succeeded.filter((id) => !reviewIds.includes(id));
      for (const p of products.filter((row) => reviewIds.includes(row.id))) {
        await queueContentReview(db, { contentType: "digital_product", contentId: p.id, teacherId: p.teacherId });
      }
      if (goLiveIds.length > 0) {
        await db
          .updateTable("digitalProducts")
          .set({ status: "published", isPublished: true, publishedAt: new Date() })
          .where("id", "in", goLiveIds)
          .execute();
      }
      needsReview = reviewIds.length > 0;
    } else {
      // Unpublish and archive both take live products off the store, so the
      // published bundles holding any of them have to go down in the same
      // transaction. Products that are not live hold no bundle up.
      for (const p of products) succeeded.push(p.id);
      const liveIds = products.filter((p) => p.status === "published").map((p) => p.id);

      if (succeeded.length > 0) {
        const result = await db.transaction().execute(async (trx) => {
          const bundles = await findPublishedBundlesContaining(trx, "digital_product", liveIds);
          if (bundles.length > 0 && !input.confirmBundleUnpublish) {
            return { kind: "needs-confirmation" as const, bundles };
          }

          const now = new Date();
          if (input.action === "unpublish") {
            await trx
              .updateTable("digitalProducts")
              .set({ status: "draft", isPublished: false, updatedAt: now })
              .where("id", "in", succeeded)
              .execute();
            await trx
              .deleteFrom("cartItems")
              .where("digitalProductId", "in", succeeded)
              .execute();
          } else {
            await trx
              .updateTable("digitalProducts")
              .set({ status: "archived", isPublished: false, updatedAt: now })
              .where("id", "in", succeeded)
              .execute();
          }

          await unpublishBundles(trx, bundles, now);
          return { kind: "done" as const, bundles };
        });

        if (result.kind === "needs-confirmation") {
          return bundleConfirmationResponse(result.bundles);
        }
        unpublishedBundles = result.bundles;
      }
    }

    const output: OutputType = {
      succeeded,
      failed,
      unpublishedBundles,
      published: input.action === "publish" && !needsReview,
    };

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
