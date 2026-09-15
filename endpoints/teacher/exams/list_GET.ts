import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { OutputType } from "./list_GET.schema";
import superjson from "superjson";

export async function handle(request: Request): Promise<Response> {
  try {
        await getServerUserSession(request);

    const exams = await db
      .selectFrom("exams")
      .innerJoin("examCategories", "exams.categoryId", "examCategories.id")
      .select([
        "exams.id",
        "exams.examName",
        "exams.fullName",
        "examCategories.categoryName",
      ])
      .orderBy("exams.examName", "asc")
      .execute();

    return new Response(superjson.stringify({ exams } satisfies OutputType));
  } catch (error) {
    console.error("[teacher/exams/list_GET] Error fetching exams:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    
    if (errorMessage === "Unauthorized") {
        return new Response(
            superjson.stringify({ error: "You must be logged in to view exams." }),
            { status: 401 }
        );
    }

    return new Response(
      superjson.stringify({ error: errorMessage }),
      { status: 500 }
    );
  }
}