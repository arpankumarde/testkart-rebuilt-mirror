import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, OutputType } from "./deactivate_POST.schema";
import superjson from "superjson";

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request);

    const json = superjson.parse(await request.text());
    const { liveTestId } = schema.parse(json);

    const result = await db
      .updateTable("liveTests")
      .set({ isActive: false })
      .where("id", "=", liveTestId)
      .where("isActive", "=", true)
      .executeTakeFirst();

    if (result.numUpdatedRows === 0n) {
      const liveTest = await db
        .selectFrom("liveTests")
        .select("isActive")
        .where("id", "=", liveTestId)
        .executeTakeFirst();
      
      if (!liveTest) {
        throw new Error("Live test not found.");
      }
      if (!liveTest.isActive) {
        throw new Error("Live test is already inactive.");
      }
      throw new Error("Failed to deactivate live test.");
    }

    return new Response(superjson.stringify({ success: true } satisfies OutputType));
  } catch (error) {
    console.error("Error deactivating live test:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 400,
    });
  }
}