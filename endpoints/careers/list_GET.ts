import { OutputType } from "./list_GET.schema";
import superjson from "superjson";
import { db } from "../../helpers/db";

export async function handle(request: Request) {
  try {
    const careers = await db
      .selectFrom("careerPostings")
      .selectAll()
      .where("isActive", "=", true)
      .orderBy("orderIndex", "asc")
      .orderBy("createdAt", "desc")
      .execute();

    return new Response(
      superjson.stringify({
        careers,
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("Error fetching public careers list:", error);
    return new Response(
      superjson.stringify({
        error: error instanceof Error ? error.message : "Internal Server Error",
      }),
      { status: 500 }
    );
  }
}