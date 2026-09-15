import { schema, OutputType } from "./list_GET.schema";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { db } from "../../../helpers/db";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId, teacherRole } = await getServerUserSession(request);
    if (user.role !== "teacher") {
      return new Response(
        superjson.stringify({ error: "Only teachers can access work experiences" }),
        { status: 403 }
      );
    }

    const workExperiences = await db
      .selectFrom("teacherWorkExperiences")
      .selectAll()
      .where("teacherId", "=", effectiveTeacherId)
      .orderBy("startDate", "desc")
      .execute();

    return new Response(superjson.stringify(workExperiences satisfies OutputType));
  } catch (error) {
    return new Response(
      superjson.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500 }
    );
  }
}