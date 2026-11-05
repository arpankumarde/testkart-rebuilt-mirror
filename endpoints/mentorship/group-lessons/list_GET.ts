import { db } from "../../../helpers/db";
import { schema, OutputType } from "./list_GET.schema";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const url = new URL(request.url);
    const input = schema.parse({
      teacherId: url.searchParams.get("teacherId") ?? undefined,
      subject: url.searchParams.get("subject") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });

    let query = db
      .selectFrom("groupLessons")
      .innerJoin("users as teacher", "teacher.id", "groupLessons.teacherId")
      .select([
        "groupLessons.id",
        "groupLessons.title",
        "groupLessons.subject",
        "groupLessons.level",
        "groupLessons.language",
        "groupLessons.startTime",
        "groupLessons.durationMinutes",
        "groupLessons.pricePerLearner",
        "groupLessons.maxCapacity",
        "groupLessons.enrolledCount",
        "groupLessons.coverImageUrl",
        "teacher.id as teacherId",
        "teacher.displayName as teacherName",
        "teacher.avatarUrl as teacherAvatarUrl",
      ])
      .where("groupLessons.status", "=", "scheduled")
      .where("groupLessons.startTime", ">", new Date())
      .where((eb) => eb("groupLessons.enrolledCount", "<", eb.ref("groupLessons.maxCapacity")));

    if (input.teacherId) query = query.where("groupLessons.teacherId", "=", input.teacherId);
    if (input.subject) query = query.where("groupLessons.subject", "=", input.subject);

    const rows = await query
      .orderBy("groupLessons.startTime", "asc")
      .limit(input.limit ?? 50)
      .execute();

    const output: OutputType = { groupLessons: rows.map((r) => ({ ...r, pricePerLearner: Number(r.pricePerLearner) })) };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error listing group lessons:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}
