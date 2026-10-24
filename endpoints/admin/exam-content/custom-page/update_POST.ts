import { sql } from "kysely";
import { db } from "../../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../../helpers/getAdminSession";
import { schema, OutputType } from "./update_POST.schema";
import superjson from "superjson";
import { customPageType } from "../../../../helpers/examContentTypes";

// Renames a custom page, and moves it to a new URL when newSlug is sent. The
// sidebar and the public navigation both read the label from exam_custom_pages,
// so a new name shows everywhere at once. A title still holding the default built
// from the old name follows it; a title the admin wrote is left alone. updatedAt
// stays put, since a change to it would reload the editor over unsaved edits.
export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request);

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);
    const nextSlug = input.newSlug ?? input.slug;

    const page = await db
      .selectFrom("examCustomPages")
      .innerJoin("exams", "examCustomPages.examId", "exams.id")
      .select(["examCustomPages.id", "examCustomPages.label", "exams.examName", "exams.fullName"])
      .where("examCustomPages.examId", "=", input.examId)
      .where("examCustomPages.slug", "=", input.slug)
      .executeTakeFirst();
    if (!page) {
      return new Response(superjson.stringify({ error: "That custom page no longer exists." }), {
        status: 404,
      });
    }

    if (nextSlug !== input.slug) {
      const taken = await db
        .selectFrom("examCustomPages")
        .select("id")
        .where("examId", "=", input.examId)
        .where("slug", "=", nextSlug)
        .executeTakeFirst();
      if (taken) {
        return new Response(
          superjson.stringify({ error: `This exam already has a page at /${nextSlug}.` }),
          { status: 409 }
        );
      }
    }

    const examLabel = page.fullName || page.examName;
    const oldTitle = `${examLabel} ${page.label}`;
    const newTitle = `${examLabel} ${input.label}`;
    const retitled = (column: "title" | "seoTitle" | "publishedTitle" | "publishedSeoTitle") =>
      sql<string>`case when ${sql.ref(column)} = ${oldTitle} then ${newTitle} else ${sql.ref(column)} end`;

    const row = await db.transaction().execute(async (trx) => {
      const updated = await trx
        .updateTable("examCustomPages")
        .set({ label: input.label, slug: nextSlug })
        .where("id", "=", page.id)
        .returning(["id", "slug", "label"])
        .executeTakeFirstOrThrow();
      await trx
        .updateTable("examContentPages")
        .set({
          pageType: customPageType(nextSlug),
          title: retitled("title"),
          seoTitle: retitled("seoTitle"),
          publishedTitle: retitled("publishedTitle"),
          publishedSeoTitle: retitled("publishedSeoTitle"),
        })
        .where("examId", "=", input.examId)
        .where("pageType", "=", customPageType(input.slug))
        .execute();
      return updated;
    });

    return new Response(
      superjson.stringify({
        customPage: { ...row, pageType: customPageType(row.slug) },
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("[admin/exam-content/custom-page/update_POST] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}