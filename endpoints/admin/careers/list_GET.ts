import { OutputType } from "./list_GET.schema";
import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);

    const careers = await db
      .selectFrom("careerPostings")
      .selectAll()
      .orderBy("orderIndex", "asc")
      .orderBy("createdAt", "desc")
      .execute();

    return new Response(
      superjson.stringify({
        careers,
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("Error fetching admin careers list:", error);
    return new Response(
      superjson.stringify({
        error: error instanceof Error ? error.message : "Internal Server Error",
      }),
      { status: 401 }
    );
  }
}