import { schema, OutputType, EmailTemplate } from "./list_GET.schema";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    // Require admin authentication
    await getAdminServerSessionOrThrow(request);

    const templates = await db
      .selectFrom("emailTemplates")
      .selectAll()
      .orderBy("name", "asc")
      .execute();

    // Parse placeholders from JSON to string array
    const parsedTemplates: EmailTemplate[] = templates.map((t) => ({
      ...t,
      placeholders: Array.isArray(t.placeholders)
        ? (t.placeholders as string[])
        : [],
    }));

    return new Response(
      superjson.stringify({
        templates: parsedTemplates,
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