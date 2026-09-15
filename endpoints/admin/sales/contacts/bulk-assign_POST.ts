import { db } from "../../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../../helpers/getAdminSession";
import { schema, OutputType } from "./bulk-assign_POST.schema";
import superjson from "superjson";

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request, ["super_admin", "admin", "manager"]);
    
    const json = superjson.parse(await request.text());
    const result = schema.parse(json);

    const updateResult = await db
      .updateTable("salesContacts")
      .set({ 
        assignedToAdminId: result.assignedToAdminId,
        updatedAt: new Date()
      })
      .where("id", "in", result.contactIds)
      .executeTakeFirst();

    return new Response(
      superjson.stringify({ 
        success: true, 
        updatedCount: Number(updateResult.numUpdatedRows)
      } satisfies OutputType),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error bulk assigning sales contacts:", error);
    return new Response(
      superjson.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
}