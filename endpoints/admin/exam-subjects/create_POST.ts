import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, OutputType } from "./create_POST.schema";
import superjson from "superjson";
import { slugify } from "../../../helpers/slugify";

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request, ['super_admin', 'admin', 'manager']);

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const subjectSlug = input.subjectSlug
      ? slugify(input.subjectSlug)
      : slugify(input.subjectName);

    // Check for uniqueness within the same exam
    const existingSubject = await db
      .selectFrom("examSubjects")
      .select("id")
      .where("subjectSlug", "=", subjectSlug)
      .where("examId", "=", input.examId)
      .executeTakeFirst();

    if (existingSubject) {
      return new Response(
        superjson.stringify({
          error: "A subject with this slug already exists for this exam.",
        }),
        { status: 409 }
      );
    }

    const newSubject = await db
      .insertInto("examSubjects")
      .values({
        examId: input.examId,
        subjectName: input.subjectName,
        subjectSlug: subjectSlug,
        description: input.description,
        orderIndex: input.orderIndex,
        isActive: input.isActive,
        syllabusTopics: input.syllabusTopics,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return new Response(
      superjson.stringify({ subject: newSubject } satisfies OutputType)
    );
  } catch (error) {
    console.error("[admin/exam-subjects/create_POST] Error creating exam subject:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: errorMessage }),
      { status: 500 }
    );
  }
}