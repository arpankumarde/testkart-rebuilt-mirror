import { db } from "../../helpers/db";
import { OutputType } from "./avatars_GET.schema";
import superjson from "superjson";
import { sql } from "kysely";

export async function handle(request: Request): Promise<Response> {
  try {
    // Fetch 50 random active teachers who have an avatar
    // We use RANDOM() to keep the list fresh and interesting
    const teachers = await db
      .selectFrom("users")
      .select(["displayName", "avatarUrl"])
      .where("role", "=", "teacher")
      .where("isActive", "=", true)
      .where("avatarUrl", "is not", null)
      .where("avatarUrl", "!=", "") // Ensure it's not an empty string
      .orderBy(sql`RANDOM()`)
      .limit(50)
      .execute();

    const output: OutputType = {
      teachers: teachers.map((t) => ({
        displayName: t.displayName,
        avatarUrl: t.avatarUrl,
      })),
    };

    return new Response(superjson.stringify(output), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300, stale-while-revalidate=600", // Cache for 5 minutes
      },
    });
  } catch (error) {
    console.error("Error fetching teacher avatars:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 500,
    });
  }
}