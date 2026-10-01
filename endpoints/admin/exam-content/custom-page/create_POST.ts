import { db } from "../../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../../helpers/getAdminSession";
import { schema, OutputType } from "./create_POST.schema";
import superjson from "superjson";
import { customPageType } from "../../../../helpers/examContentTypes";

// Adds a custom page (sidebar tab) to an exam. It starts empty - content is
// written through the normal exam-content upsert/generate/publish endpoints
// under the page type "custom:<slug>". The slug is fixed once created, since
// it is both the content row's key and the public URL.
export async function handle(request: Request): Promise<Response> {
  try {
    const admin = await getAdminServerSessionOrThrow(request);

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const exam = await db
      .selectFrom("exams")
      .select("id")
      .where("id", "=", input.examId)
      .executeTakeFirst();
    if (!exam) {
      return new Response(superjson.stringify({ error: "Exam not found." }), { status: 404 });
    }

    const taken = await db
      .selectFrom("examCustomPages")
      .select("id")
      .where("examId", "=", input.examId)
      .where("slug", "=", input.slug)
      .executeTakeFirst();
    if (taken) {
      return new Response(
        superjson.stringify({ error: `This exam already has a page at /${input.slug}.` }),
        { status: 409 }
      );
    }

    const last = await db
      .selectFrom("examCustomPages")
      .select((eb) => eb.fn.max("sortOrder").as("maxOrder"))
      .where("examId", "=", input.examId)
      .executeTakeFirst();

    const row = await db
      .insertInto("examCustomPages")
      .values({
        examId: input.examId,
        label: input.label,
        slug: input.slug,
        sortOrder: (last?.maxOrder ?? -1) + 1,
        createdByAdminId: admin.id,
      })
      .returning(["id", "slug", "label"])
      .executeTakeFirstOrThrow();

    return new Response(
      superjson.stringify({
        customPage: { ...row, pageType: customPageType(row.slug) },
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("[admin/exam-content/custom-page/create_POST] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}