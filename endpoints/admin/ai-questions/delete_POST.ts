import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { syncMockTestAggregates } from "../../../helpers/syncMockTestAggregates";
import { schema, OutputType } from "./delete_POST.schema";
import superjson from "superjson";

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request);

    const json = superjson.parse(await request.text());
    const { id } = schema.parse(json);

    const owner = await db
      .selectFrom("testQuestions")
      .innerJoin("mockTestItems", "mockTestItems.id", "testQuestions.testId")
      .select("mockTestItems.packageId")
      .where("testQuestions.id", "=", id)
      .executeTakeFirst();

    const result = await db
      .deleteFrom("testQuestions")
      .where("id", "=", id)
      .where("isAiGenerated", "=", true)
      .executeTakeFirst();

    if (result.numDeletedRows === 0n) {
      return new Response(
        superjson.stringify({ error: "AI question not found or could not be deleted." }),
        { status: 404 }
      );
    }

    if (owner) await syncMockTestAggregates(owner.packageId);

    return new Response(superjson.stringify({ success: true } satisfies OutputType));
  } catch (error) {
    console.error("[admin/ai-questions/delete_POST] Error deleting AI question:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}