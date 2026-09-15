import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, OutputType } from "./deactivate_POST.schema";
import superjson from "superjson";

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request, ['super_admin', 'admin', 'manager']);

    const json = superjson.parse(await request.text());
    const { testId } = schema.parse(json);

    const test = await db
      .selectFrom("mockTests")
      .select("id")
      .where("id", "=", testId)
      .executeTakeFirst();

    if (!test) {
      return new Response(
        superjson.stringify({ error: "Test not found." }),
        { status: 404 }
      );
    }

    await db
      .updateTable("mockTests")
      .set({ isPublished: false })
      .where("id", "=", testId)
      .execute();

    await db
      .deleteFrom("cartItems")
      .where("mockTestId", "=", testId)
      .execute();

    console.log(`Deleted cart items referencing deactivated mock test ${testId}`);

    const output: OutputType = { success: true };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error deactivating test:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 400,
    });
  }
}