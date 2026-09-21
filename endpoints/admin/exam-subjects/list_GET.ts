import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, OutputType } from "./list_GET.schema";
import superjson from "superjson";

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request);

    const url = new URL(request.url);
    const examId = url.searchParams.get("examId");
    const parsedInput = schema.parse({
      examId: examId ? Number(examId) : undefined,
    });

    const subjects = await db
      .selectFrom("examSubjects")
      .selectAll()
      .where("examId", "=", parsedInput.examId)
      .orderBy("orderIndex", "asc")
      .execute();

    return new Response(
      superjson.stringify({ subjects } satisfies OutputType)
    );
  } catch (error) {
    console.error("[admin/exam-subjects/list_GET] Error fetching exam subjects:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: errorMessage }),
      { status: 500 }
    );
  }
}