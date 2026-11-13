import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { OutputType } from "./list_GET.schema";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Unauthorized" }), { status: 403 });
    }

    const rows = await db
      .selectFrom("groupLessons")
      .select([
        "id",
        "title",
        "subject",
        "level",
        "language",
        "startTime",
        "durationMinutes",
        "pricePerLearner",
        "maxCapacity",
        "enrolledCount",
        "minEnrollment",
        "minEnrollmentPolicy",
        "status",
        "coverImageUrl",
        "cancellationReason",
      ])
      .where("teacherId", "=", effectiveTeacherId)
      .where("liveCourseId", "is", null)
      .orderBy("startTime", "desc")
      .limit(200)
      .execute();

    const output: OutputType = {
      groupLessons: rows.map((r) => ({ ...r, pricePerLearner: Number(r.pricePerLearner) })),
    };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error fetching teacher group lessons:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}
