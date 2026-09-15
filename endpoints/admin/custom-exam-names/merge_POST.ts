import { schema, OutputType } from "./merge_POST.schema";
import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);
    const json = superjson.parse(await request.text());
    const { sourceNames, targetExamId } = schema.parse(json);

    const targetExam = await db
      .selectFrom("exams")
      .select(["id", "examName", "examSlug"])
      .where("id", "=", targetExamId)
      .executeTakeFirst();

    if (!targetExam) {
      return new Response(
        superjson.stringify({ error: "Target exam not found." }),
        { status: 404 }
      );
    }

    const { mergedMockTests, mergedProducts } = await db.transaction().execute(async (trx) => {
      const mockTestsResult = await trx
        .updateTable("mockTests")
        .set({ examId: targetExamId })
        .where("examName", "in", sourceNames)
        .where("examId", "is", null)
        .executeTakeFirst();

      const productsResult = await trx
        .updateTable("digitalProducts")
        .set({ examId: targetExamId })
        .where("examName", "in", sourceNames)
        .where("examId", "is", null)
        .executeTakeFirst();

      return {
        mergedMockTests: Number(mockTestsResult.numUpdatedRows ?? 0),
        mergedProducts: Number(productsResult.numUpdatedRows ?? 0),
      };
    });

    return new Response(
      superjson.stringify({
        success: true,
        mergedMockTests,
        mergedProducts,
        targetExam,
      } satisfies OutputType)
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    return new Response(superjson.stringify({ error: message }), {
      status: 400,
    });
  }
}
