import { schema, OutputType } from "./moderate_POST.schema";
import superjson from "superjson";
import { db } from "../../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../../helpers/getAdminSession";

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);
    
    const json = superjson.parse(await request.text());
    const input = schema.parse(json);
    
    if (input.action === "delete") {
      // Safely detaches any child replies directly targeted at this item to prevent database locks
      await db.deleteFrom("blogComments").where("parentId", "=", input.commentId).execute();
      await db.deleteFrom("blogComments").where("id", "=", input.commentId).execute();
    } else {
      const status = input.action === "approve" ? "approved" : "rejected";
      await db.updateTable("blogComments")
        .set({ status, updatedAt: new Date() })
        .where("id", "=", input.commentId)
        .execute();
    }

    return new Response(superjson.stringify({ success: true } satisfies OutputType), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      superjson.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
}