import { OutputType } from "./list_GET.schema";
import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);

    const items = await db
      .selectFrom("newsCoverage")
      .selectAll()
      .orderBy("publishedAt", "desc")
      .orderBy("id", "desc")
      .execute();

    return new Response(superjson.stringify({ items } satisfies OutputType));
  } catch (error) {
    console.error("Error fetching admin news coverage list:", error);
    return new Response(
      superjson.stringify({
        error: error instanceof Error ? error.message : "Internal Server Error",
      }),
      { status: 400 }
    );
  }
}
