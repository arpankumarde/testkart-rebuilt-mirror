import { OutputType, schema } from "./upsert_POST.schema";
import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { slugify } from "../../../helpers/slugify";

/** Trims each comma-separated keyword, drops blanks and duplicates. */
function normaliseKeywords(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const keywords = Array.from(
    new Set(
      raw
        .split(",")
        .map((keyword) => keyword.trim())
        .filter(Boolean)
    )
  );
  return keywords.length > 0 ? keywords.join(", ") : null;
}

async function uniqueSlug(desired: string, excludeId?: number): Promise<string> {
  const baseSlug = slugify(desired) || "news";
  let candidate = baseSlug;
  let counter = 2;

  while (true) {
    let query = db
      .selectFrom("newsCoverage")
      .select("id")
      .where("slug", "=", candidate);

    if (excludeId !== undefined) {
      query = query.where("id", "!=", excludeId);
    }

    if (!(await query.executeTakeFirst())) {
      return candidate;
    }
    candidate = `${baseSlug}-${counter}`;
    counter++;
  }
}

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const values = {
      title: input.title,
      publicationName: input.publicationName ?? null,
      imageUrl: input.imageUrl,
      imageFileId: input.imageFileId ?? null,
      excerpt: input.excerpt ?? null,
      writeup: input.writeup,
      coverageUrl: input.coverageUrl ?? null,
      keywords: normaliseKeywords(input.keywords),
      publishedAt: input.publishedAt,
      isPublished: input.isPublished,
      updatedAt: new Date(),
    };

    if (!input.id) {
      const created = await db
        .insertInto("newsCoverage")
        .values({
          ...values,
          slug: await uniqueSlug(input.slug || input.title),
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      return new Response(
        superjson.stringify({ success: true, item: created } satisfies OutputType)
      );
    }

    const existing = await db
      .selectFrom("newsCoverage")
      .select(["id", "slug", "previousSlugs"])
      .where("id", "=", input.id)
      .executeTakeFirst();

    if (!existing) {
      return new Response(
        superjson.stringify({ error: "News coverage not found" }),
        { status: 404 }
      );
    }

    // A slug change retires the old one into previousSlugs rather than
    // dropping it, so already-indexed URLs keep resolving - the detail
    // lookup falls back to that list and redirects to the canonical slug.
    const nextSlug = await uniqueSlug(input.slug || input.title, existing.id);
    const previousSlugs =
      nextSlug === existing.slug
        ? existing.previousSlugs
        : Array.from(
            new Set([...existing.previousSlugs, existing.slug])
          ).filter((slug) => slug !== nextSlug);

    const updated = await db
      .updateTable("newsCoverage")
      .set({ ...values, slug: nextSlug, previousSlugs })
      .where("id", "=", existing.id)
      .returningAll()
      .executeTakeFirstOrThrow();

    return new Response(
      superjson.stringify({ success: true, item: updated } satisfies OutputType)
    );
  } catch (error) {
    console.error("Error saving news coverage:", error);
    return new Response(
      superjson.stringify({
        error: error instanceof Error ? error.message : "Internal Server Error",
      }),
      { status: 400 }
    );
  }
}
