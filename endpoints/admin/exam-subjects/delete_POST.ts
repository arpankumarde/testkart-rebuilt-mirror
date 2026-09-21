import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, OutputType } from "./delete_POST.schema";
import superjson from "superjson";

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request);

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    await db.transaction().execute(async (trx) => {
      // Delete the exam subject
      const result = await trx
        .deleteFrom("examSubjects")
        .where("id", "=", input.id)
        .executeTakeFirst();

      if (result.numDeletedRows === 0n) {
        throw new Error("Subject not found or could not be deleted.");
      }
    });

    return new Response(
      superjson.stringify({
        success: true,
        message: "Subject deleted successfully.",
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("[admin/exam-subjects/delete_POST] Error deleting exam subject:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: errorMessage }),
      { status: 500 }
    );
  }
}