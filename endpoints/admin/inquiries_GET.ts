import { db } from "../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../helpers/getAdminSession";
import { OutputType } from "./inquiries_GET.schema";
import { InquiryStatusArrayValues } from "../../helpers/schema";
import superjson from "superjson";
import { Selectable } from "kysely";
import { TeacherInquiries } from "../../helpers/schema";

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request);

    const url = new URL(request.url);
    const status = url.searchParams.get("status");

    let query = db
      .selectFrom("teacherInquiries")
      .selectAll()
      .orderBy("createdAt", "desc");

    if (
      status &&
      (InquiryStatusArrayValues as readonly string[]).includes(status)
    ) {
      query = query.where("status", "=", status as Selectable<TeacherInquiries>["status"]);
    }

    const inquiries = await query.execute();

    const output: OutputType = { inquiries };

    return new Response(superjson.stringify(output), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching teacher inquiries:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}