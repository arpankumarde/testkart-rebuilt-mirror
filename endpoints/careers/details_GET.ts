import { OutputType, schema } from "./details_GET.schema";
import superjson from "superjson";
import { db } from "../../helpers/db";

export async function handle(request: Request) {
  try {
    const url = new URL(request.url);
    const slug = url.searchParams.get("slug");
    
    if (!slug) {
      return new Response(
        superjson.stringify({ error: "Slug is required" }),
        { status: 400 }
      );
    }

    const parsed = schema.parse({ slug });

    const career = await db
      .selectFrom("careerPostings")
      .selectAll()
      .where("slug", "=", parsed.slug)
      .where("isActive", "=", true)
      .executeTakeFirst();

    if (!career) {
      return new Response(
        superjson.stringify({ error: "Career posting not found" }),
        { status: 404 }
      );
    }

    return new Response(
      superjson.stringify({
        career,
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("Error fetching career details:", error);
    return new Response(
      superjson.stringify({
        error: error instanceof Error ? error.message : "Internal Server Error",
      }),
      { status: 500 }
    );
  }
}