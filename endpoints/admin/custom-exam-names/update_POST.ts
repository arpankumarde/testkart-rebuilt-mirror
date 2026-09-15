import { schema, OutputType } from "./update_POST.schema";
import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);
    const json = superjson.parse(await request.text());
    const { oldName, newName } = schema.parse(json);

    await db.transaction().execute(async (trx) => {
      await trx
        .updateTable("mockTests")
        .set({ examName: newName })
        .where("examName", "=", oldName)
        .where("examId", "is", null)
        .execute();

      await trx
        .updateTable("digitalProducts")
        .set({ examName: newName })
        .where("examName", "=", oldName)
        .where("examId", "is", null)
        .execute();
    });

    return new Response(
      superjson.stringify({
        success: true,
        message: "Exam name updated successfully",
      } satisfies OutputType)
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    return new Response(superjson.stringify({ error: message }), {
      status: 400,
    });
  }
}