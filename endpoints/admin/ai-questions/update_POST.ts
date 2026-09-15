import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, OutputType } from "./update_POST.schema";
import superjson from "superjson";

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request, ['super_admin', 'admin']);

    const json = superjson.parse(await request.text());
    const { id, ...updateData } = schema.parse(json);

    const updatedQuestion = await db
      .updateTable("testQuestions")
      .set(updateData)
      .where("id", "=", id)
      .where("isAiGenerated", "=", true)
      .returningAll()
      .executeTakeFirst();

    if (!updatedQuestion) {
      return new Response(
        superjson.stringify({ error: "AI question not found or could not be updated." }),
        { status: 404 }
      );
    }

    return new Response(superjson.stringify({ success: true, question: updatedQuestion } satisfies OutputType));
  } catch (error) {
    console.error("[admin/ai-questions/update_POST] Error updating AI question:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}