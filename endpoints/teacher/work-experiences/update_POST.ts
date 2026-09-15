import { schema, OutputType } from "./update_POST.schema";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { db } from "../../../helpers/db";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId, teacherRole } = await getServerUserSession(request);
    if (user.role !== "teacher") {
      return new Response(
        superjson.stringify({ error: "Only teachers can update work experiences" }),
        { status: 403 }
      );
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    // Verify ownership
    const existing = await db
      .selectFrom("teacherWorkExperiences")
      .select("id")
      .where("id", "=", input.id)
      .where("teacherId", "=", effectiveTeacherId)
      .executeTakeFirst();

    if (!existing) {
      return new Response(
        superjson.stringify({ error: "Work experience not found or access denied" }),
        { status: 404 }
      );
    }

    // If isCurrent is true, ensure endDate is null
    const endDate = input.isCurrent ? null : input.endDate;

    const result = await db
      .updateTable("teacherWorkExperiences")
      .set({
        companyName: input.companyName,
        position: input.position,
        startDate: input.startDate,
        endDate: endDate,
        isCurrent: input.isCurrent,
        description: input.description,
        location: input.location,
        updatedAt: new Date(),
      })
      .where("id", "=", input.id)
      .returningAll()
      .executeTakeFirstOrThrow();

    return new Response(superjson.stringify(result satisfies OutputType));
  } catch (error) {
    return new Response(
      superjson.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500 }
    );
  }
}