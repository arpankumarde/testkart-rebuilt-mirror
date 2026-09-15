import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./issued_GET.schema";
import superjson from "superjson";
import { ZodError } from "zod";

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId, teacherRole } = await getServerUserSession(request);
    if (user.role !== "teacher") {
      return new Response(
        superjson.stringify({ error: "Only teachers can view issued certificates." }),
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const { page, limit } = schema.parse({
      page: url.searchParams.get("page") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });
    const offset = (page - 1) * limit;

    const baseQuery = db
      .selectFrom("certificates")
      .innerJoin("users", "users.id", "certificates.studentId")
      .leftJoin("courses", "courses.id", "certificates.courseId")
      .leftJoin("mockTestItems", "mockTestItems.id", "certificates.testItemId")
      .leftJoin("mockTests", "mockTests.id", "mockTestItems.packageId")
      .where((eb) =>
        eb.or([
          eb("courses.teacherId", "=", effectiveTeacherId),
          eb("mockTests.teacherId", "=", effectiveTeacherId),
        ])
      );

    const certificates = await baseQuery
      .selectAll("certificates")
      .select([
        "users.displayName as studentName",
        (eb) => eb.fn<string>("coalesce", ["courses.title", "mockTestItems.title"]).as("itemName"),
      ])
      .orderBy("certificates.issuedAt", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    const totalResult = await baseQuery
      .select(db.fn.countAll().as("count"))
      .executeTakeFirst();

    const total = Number(totalResult?.count ?? 0);

    const output: OutputType = { certificates, total };

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error fetching teacher's issued certificates:", error);
    if (error instanceof ZodError) {
      return new Response(
        superjson.stringify({ error: "Invalid page or limit.", details: error.issues }),
        { status: 400 }
      );
    }
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: "Failed to fetch certificates.", details: errorMessage }),
      { status: 500 }
    );
  }
}
