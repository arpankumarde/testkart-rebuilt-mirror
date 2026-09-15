import { db } from "../../helpers/db";
import { OutputType } from "./custom-names_GET.schema";
import superjson from "superjson";

export async function handle(request: Request): Promise<Response> {
  try {
    const mockTestsQuery = db
      .selectFrom("mockTests")
      .select("examName")
      .where("examId", "is", null)
      .where("examName", "is not", null)
      .where("examName", "!=", "")
      .where("deletedAt", "is", null);

    const digitalProductsQuery = db
      .selectFrom("digitalProducts")
      .select("examName")
      .where("examId", "is", null)
      .where("examName", "is not", null)
      .where("examName", "!=", "");

    const result = await db
      .selectFrom(mockTestsQuery.union(digitalProductsQuery).as("custom_names"))
      .select("examName")
      .orderBy("examName", "asc")
      .execute();

    // Map and filter out any potential remaining nulls to ensure string[] type
    const names = result
      .map((row) => row.examName)
      .filter((name): name is string => typeof name === "string");

    return new Response(
      superjson.stringify({
        names,
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("[exams/custom-names_GET] Error fetching custom exam names:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 500,
    });
  }
}