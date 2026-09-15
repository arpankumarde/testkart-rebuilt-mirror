import { db } from '../helpers/db';
import { schema, OutputType } from "./static-page_GET.schema";
import superjson from "superjson";
import { ZodError } from "zod";

export async function handle(request: Request) {
  try {
    const url = new URL(request.url);
    const slug = url.searchParams.get("slug");

    const validatedInput = schema.parse({ slug });

    const page = await db.
    selectFrom("staticPages").
    select(["id", "slug", "title", "content", "updatedAt"]).
    where("slug", "=", validatedInput.slug).
    executeTakeFirst();

    if (!page) {
      return new Response(
        superjson.stringify({ error: "Page not found" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    return new Response(superjson.stringify(page satisfies OutputType), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Failed to fetch static page:", error);
    if (error instanceof ZodError) {
      return new Response(
        superjson.stringify({ error: "Invalid slug provided", details: error.errors }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
    const errorMessage =
    error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}