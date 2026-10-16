import superjson from "superjson";
import { schema, OutputType } from "./status_POST.schema";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { currentAffairsServer, CurrentAffairsInputError } from "../../../helpers/currentAffairsServer";
import { validateCurrentAffairs } from "../../../helpers/currentAffairsValidation";
import type { CurrentAffairsStatus } from "../../../helpers/schema";

export async function handle(request: Request) {
  try {
    const admin = await getAdminServerSessionOrThrow(request);
    const input = schema.parse(superjson.parse(await request.text()));

    await currentAffairsServer.promoteDue();
    const detail = await currentAffairsServer.loadDetail(input.id);
    if (!detail) {
      return new Response(superjson.stringify({ error: "Current affairs post not found" }), { status: 404 });
    }

    const now = new Date();
    let status: CurrentAffairsStatus;

    if (input.action === "publish") {
      // Publishing from the list goes live now; a future time set in the editor is overridden.
      const asPublished = { ...currentAffairsServer.detailToInput(detail, "published"), publishAt: "" };
      const issues = validateCurrentAffairs(asPublished, now);
      if (issues.length > 0) {
        throw new CurrentAffairsInputError(
          `Not ready to publish: ${issues.length} field${issues.length === 1 ? " needs" : "s need"} attention in the editor`,
          issues
        );
      }
      await currentAffairsServer.save(asPublished, admin.id);
      status = "published";
    } else if (input.action === "unpublish") {
      if (detail.status !== "published" && detail.status !== "scheduled") {
        throw new Error("Only published or scheduled posts can be unpublished");
      }
      await db
        .updateTable("currentAffairsPosts")
        .set({ status: "draft", publishedAt: null, updatedBy: admin.id, updatedAt: now })
        .where("id", "=", input.id)
        .execute();
      status = "draft";
    } else if (input.action === "archive") {
      await db
        .updateTable("currentAffairsPosts")
        .set({ status: "archived", publishedAt: null, archivedAt: now, updatedBy: admin.id, updatedAt: now })
        .where("id", "=", input.id)
        .execute();
      status = "archived";
    } else {
      if (detail.status !== "archived") throw new Error("Only archived posts can be restored");
      await db
        .updateTable("currentAffairsPosts")
        .set({ status: "draft", archivedAt: null, updatedBy: admin.id, updatedAt: now })
        .where("id", "=", input.id)
        .execute();
      status = "draft";
    }

    return new Response(superjson.stringify({ success: true, status } satisfies OutputType));
  } catch (error) {
    return currentAffairsServer.errorResponse(error, "Error changing current affairs status");
  }
}