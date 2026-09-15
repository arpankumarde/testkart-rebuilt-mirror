import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { db } from "../../../helpers/db";
import { schema, OutputType } from "./update_POST.schema";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request, ['super_admin', 'admin']);
    const json = superjson.parse(await request.text());
    const result = schema.parse(json);

    // Validate that the content is valid JSON before saving
    try {
      JSON.parse(result.content);
    } catch (e) {
      throw new Error("Content must be valid JSON");
    }

    const updatedFile = await db
      .updateTable("wellKnownFiles")
      .set({
        content: result.content,
        updatedAt: new Date(),
      })
      .where("fileKey", "=", result.fileKey)
      .returningAll()
      .executeTakeFirst();

    if (!updatedFile) {
      throw new Error(`File with key ${result.fileKey} not found`);
    }

    return new Response(superjson.stringify({ success: true, updatedFile } satisfies OutputType), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { 
      status: 400, 
      headers: { "Content-Type": "application/json" } 
    });
  }
}