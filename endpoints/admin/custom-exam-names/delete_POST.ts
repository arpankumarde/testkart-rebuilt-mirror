import { schema, OutputType } from "./delete_POST.schema";
import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);
    const json = superjson.parse(await request.text());
    const { name } = schema.parse(json);

    await db.transaction().execute(async (trx) => {
      await trx
        .updateTable("mockTests")
        .set({ examName: null })
        .where("examName", "=", name)
        .where("examId", "is", null)
        .execute();

      await trx
        .updateTable("digitalProducts")
        .set({ examName: null })
        .where("examName", "=", name)
        .where("examId", "is", null)
        .execute();
    });

    return new Response(
      superjson.stringify({ success: true } satisfies OutputType)
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    return new Response(superjson.stringify({ error: message }), {
      status: 400,
    });
  }
}