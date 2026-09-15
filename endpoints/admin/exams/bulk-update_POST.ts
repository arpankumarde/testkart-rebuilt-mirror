import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, type OutputType } from "./bulk-update_POST.schema";
import superjson from "superjson";

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request, ["super_admin", "admin", "manager"]);

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const updates: {
      categoryId?: number;
      ownerTag?: string | null;
      contentDueDate?: Date | null;
      updatedAt: Date;
    } = { updatedAt: new Date() };

    if (input.categoryId !== undefined) updates.categoryId = input.categoryId;
    if (input.ownerTag !== undefined) updates.ownerTag = input.ownerTag;
    if (input.contentDueDate !== undefined) updates.contentDueDate = input.contentDueDate;

    if (Object.keys(updates).length === 1) {
      // Only updatedAt is set — nothing was actually requested to change.
      return new Response(
        superjson.stringify({ error: "No fields provided to update." }),
        { status: 400 }
      );
    }

    const result = await db
      .updateTable("exams")
      .set(updates)
      .where("id", "in", input.examIds)
      .executeTakeFirst();

    return new Response(
      superjson.stringify({
        updatedCount: Number(result.numUpdatedRows ?? input.examIds.length),
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("[admin/exams/bulk-update_POST] Error bulk-updating exams:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 500 });
  }
}
