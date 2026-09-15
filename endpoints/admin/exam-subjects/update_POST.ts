import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, OutputType } from "./update_POST.schema";
import superjson from "superjson";
import { slugify } from "../../../helpers/slugify";

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request, ['super_admin', 'admin', 'manager']);

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const { id, ...updateData } = input;

    if (updateData.subjectSlug) {
      updateData.subjectSlug = slugify(updateData.subjectSlug);
    } else if (updateData.subjectName) {
      updateData.subjectSlug = slugify(updateData.subjectName);
    }

    if (updateData.subjectSlug) {
      const subject = await db.selectFrom("examSubjects").select("examId").where("id", "=", id).executeTakeFirst();
      if (!subject) {
        return new Response(superjson.stringify({ error: "Subject not found." }), { status: 404 });
      }

      const existingSubject = await db
        .selectFrom("examSubjects")
        .select("id")
        .where("subjectSlug", "=", updateData.subjectSlug)
        .where("examId", "=", subject.examId)
        .where("id", "!=", id)
        .executeTakeFirst();

      if (existingSubject) {
        return new Response(
          superjson.stringify({
            error: "A subject with this slug already exists for this exam.",
          }),
          { status: 409 }
        );
      }
    }

    const updatedSubject = await db
      .updateTable("examSubjects")
      .set(updateData)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();

    return new Response(
      superjson.stringify({ subject: updatedSubject } satisfies OutputType)
    );
  } catch (error) {
    console.error("[admin/exam-subjects/update_POST] Error updating exam subject:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: errorMessage }),
      { status: 500 }
    );
  }
}