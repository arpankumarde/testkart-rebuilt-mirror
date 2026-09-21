import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, OutputType } from "./bulk-delete_POST.schema";
import superjson from "superjson";

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request);

    const json = superjson.parse(await request.text());
    const { ids } = schema.parse(json);

    if (ids.length === 0) {
      return new Response(
        superjson.stringify({ error: "No question IDs provided." }),
        { status: 400 }
      );
    }

    const result = await db
      .deleteFrom("testQuestions")
      .where("id", "in", ids)
      .where("isAiGenerated", "=", true)
      .executeTakeFirst();

    const count = Number(result.numDeletedRows);

    return new Response(superjson.stringify({ success: true, count } satisfies OutputType));
  } catch (error) {
    console.error("[admin/ai-questions/bulk-delete_POST] Error bulk deleting AI questions:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}