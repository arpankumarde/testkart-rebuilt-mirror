import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { OutputType } from "./list_GET.schema";
import superjson from "superjson";
import { sql } from "kysely";

export async function handle(request: Request): Promise<Response> {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "student") {
      return new Response(
        superjson.stringify({ error: "Only students can view their certificates." }),
        { status: 403 }
      );
    }

    const certificates = await db
      .selectFrom("certificates")
      .leftJoin("courses", "courses.id", "certificates.courseId")
      .leftJoin("mockTestItems", "mockTestItems.id", "certificates.testItemId")
      .where("certificates.studentId", "=", user.id)
      .select([
        "certificates.id",
        "certificates.certificateNumber",
        "certificates.certificateType",
        "certificates.completionDate",
        "certificates.issuedAt",
        "certificates.scorePercentage",
        sql<string>`COALESCE(courses.title, mock_test_items.title)`.as("itemName"),
      ])
      .orderBy("certificates.issuedAt", "desc")
      .execute();

    const output: OutputType = { certificates };

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error fetching student certificates:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: "Failed to fetch certificates.", details: errorMessage }),
      { status: 500 }
    );
  }
}