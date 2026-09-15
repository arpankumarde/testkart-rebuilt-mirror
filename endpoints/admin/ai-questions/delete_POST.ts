import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, OutputType } from "./delete_POST.schema";
import superjson from "superjson";

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request, ['super_admin', 'admin']);

    const json = superjson.parse(await request.text());
    const { id } = schema.parse(json);

    const result = await db
      .deleteFrom("testQuestions")
      .where("id", "=", id)
      .where("isAiGenerated", "=", true)
      .executeTakeFirst();

    if (result.numDeletedRows === 0n) {
      return new Response(
        superjson.stringify({ error: "AI question not found or could not be deleted." }),
        { status: 404 }
      );
    }

    return new Response(superjson.stringify({ success: true } satisfies OutputType));
  } catch (error) {
    console.error("[admin/ai-questions/delete_POST] Error deleting AI question:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}