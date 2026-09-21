import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, OutputType } from "./bulk-mark-review_POST.schema";
import superjson from "superjson";

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request);

    const json = superjson.parse(await request.text());
    const { ids, markForReview } = schema.parse(json);

    if (ids.length === 0) {
      return new Response(
        superjson.stringify({ error: "No question IDs provided." }),
        { status: 400 }
      );
    }

    const result = await db
      .updateTable("testQuestions")
      .set({ markedForReview: markForReview })
      .where("id", "in", ids)
      .where("isAiGenerated", "=", true)
      .executeTakeFirst();

    const count = Number(result.numUpdatedRows);

    return new Response(superjson.stringify({ success: true, count } satisfies OutputType));
  } catch (error) {
    console.error("[admin/ai-questions/bulk-mark-review_POST] Error bulk updating review status:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}