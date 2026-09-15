import { schema, OutputType } from "./update_POST.schema";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    // Require admin authentication
    await getAdminServerSessionOrThrow(request, ['super_admin', 'admin']);

    const json = superjson.parse(await request.text());
    const { id, subject, htmlContent, textContent, isActive } = schema.parse(json);

    const updatedTemplate = await db
      .updateTable("emailTemplates")
      .set({
        subject,
        htmlContent,
        textContent: textContent || null,
        isActive: isActive ?? true,
        updatedAt: new Date(),
      })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();

    return new Response(
      superjson.stringify({
        success: true,
        template: updatedTemplate,
      } satisfies OutputType)
    );
  } catch (error) {
    return new Response(
      superjson.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500 }
    );
  }
}