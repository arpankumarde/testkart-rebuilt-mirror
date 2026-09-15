import { schema, OutputType } from "./make-official_POST.schema";
import superjson from "superjson";
import { db } from "../../../helpers/db";
import { sql } from "kysely";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { slugify } from "../../../helpers/slugify";

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);
    const json = superjson.parse(await request.text());
    const { name, categoryId, fullName, description } = schema.parse(json);

    const existing = await db
      .selectFrom("exams")
      .where(sql<boolean>`lower(exam_name) = lower(${name})`)
      .select("id")
      .executeTakeFirst();

    if (existing) {
      return new Response(
        superjson.stringify({ error: "Exam with this name already exists" }),
        { status: 400 }
      );
    }

    const examSlug = slugify(name);

    const resultId = await db.transaction().execute(async (trx) => {
      const newExam = await trx
        .insertInto("exams")
        .values({
          examName: name,
          fullName: fullName || name,
          categoryId,
          examSlug,
          description: description || null,
        })
        .returning("id")
        .executeTakeFirstOrThrow();

      await trx
        .updateTable("mockTests")
        .set({ examId: newExam.id })
        .where(sql<boolean>`exam_name ILIKE ${name}`)
        .where("examId", "is", null)
        .execute();

      await trx
        .updateTable("digitalProducts")
        .set({ examId: newExam.id })
        .where(sql<boolean>`exam_name ILIKE ${name}`)
        .where("examId", "is", null)
        .execute();

      return newExam.id;
    });

    return new Response(
      superjson.stringify({
        success: true,
        examId: resultId,
      } satisfies OutputType)
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    return new Response(superjson.stringify({ error: message }), {
      status: 400,
    });
  }
}