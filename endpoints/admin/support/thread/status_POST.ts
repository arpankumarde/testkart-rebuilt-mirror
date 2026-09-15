import { schema, OutputType } from "./status_POST.schema";
import superjson from 'superjson';
import { db } from "../../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../../helpers/getAdminSession";

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const thread = await db.selectFrom("supportThreads")
      .where("id", "=", input.threadId)
      .selectAll()
      .executeTakeFirst();

    if (!thread) {
      return new Response(superjson.stringify({ error: "Thread not found" }), { status: 404 });
    }

    const updatedThread = await db.updateTable("supportThreads")
      .set({
        status: input.status,
        updatedAt: new Date(),
      })
      .where("id", "=", thread.id)
      .returningAll()
      .executeTakeFirstOrThrow();

    return new Response(superjson.stringify(updatedThread satisfies OutputType));
  } catch (error) {
    return new Response(superjson.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), { status: 400 });
  }
}