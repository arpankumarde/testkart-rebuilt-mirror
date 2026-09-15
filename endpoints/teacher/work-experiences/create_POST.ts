import { schema, OutputType } from "./create_POST.schema";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { db } from "../../../helpers/db";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId, teacherRole } = await getServerUserSession(request);
    if (user.role !== "teacher") {
      return new Response(
        superjson.stringify({ error: "Only teachers can create work experiences" }),
        { status: 403 }
      );
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    // If isCurrent is true, ensure endDate is null
    const endDate = input.isCurrent ? null : input.endDate;

    const result = await db
      .insertInto("teacherWorkExperiences")
      .values({
        teacherId: effectiveTeacherId,
        companyName: input.companyName,
        position: input.position,
        startDate: input.startDate,
        endDate: endDate,
        isCurrent: input.isCurrent,
        description: input.description,
        location: input.location,
        updatedAt: new Date(), // Manually setting updatedAt on create if needed, though usually handled by DB default or trigger, but schema says Generated<Timestamp | null>
      })
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