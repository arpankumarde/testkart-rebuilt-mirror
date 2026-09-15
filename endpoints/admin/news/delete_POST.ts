import { OutputType, schema } from "./delete_POST.schema";
import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const deleteResult = await db
      .deleteFrom("newsCoverage")
      .where("id", "=", input.id)
      .executeTakeFirst();

    if (Number(deleteResult.numDeletedRows) === 0) {
      return new Response(
        superjson.stringify({ error: "News coverage not found" }),
        { status: 404 }
      );
    }

    return new Response(
      superjson.stringify({ success: true } satisfies OutputType)
    );
  } catch (error) {
    console.error("Error deleting news coverage:", error);
    return new Response(
      superjson.stringify({
        error: error instanceof Error ? error.message : "Internal Server Error",
      }),
      { status: 400 }
    );
  }
}
