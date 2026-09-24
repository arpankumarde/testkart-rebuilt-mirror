import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { syncMockTestAggregates } from "../../../helpers/syncMockTestAggregates";
import { schema, OutputType } from "./bulk-delete_POST.schema";
import superjson from "superjson";

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request);

    const json = superjson.parse(await request.text());
    const { ids } = schema.parse(json);

    if (ids.length === 0) {
      return new Response(
        superjson.stringify({ error: "No question IDs provided." }),
        { status: 400 }
      );
    }

    const owners = await db
      .selectFrom("testQuestions")
      .innerJoin("mockTestItems", "mockTestItems.id", "testQuestions.testId")
      .select("mockTestItems.packageId")
      .distinct()
      .where("testQuestions.id", "in", ids)
      .where("testQuestions.isAiGenerated", "=", true)
      .execute();

    const result = await db
      .deleteFrom("testQuestions")
      .where("id", "in", ids)
      .where("isAiGenerated", "=", true)
      .executeTakeFirst();

    const count = Number(result.numDeletedRows);

    for (const { packageId } of owners) {
      await syncMockTestAggregates(packageId);
    }

    return new Response(superjson.stringify({ success: true, count } satisfies OutputType));
  } catch (error) {
    console.error("[admin/ai-questions/bulk-delete_POST] Error bulk deleting AI questions:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}