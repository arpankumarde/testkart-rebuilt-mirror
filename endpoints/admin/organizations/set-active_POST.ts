import superjson from "superjson";
import { db } from "../../../helpers/db";
import { ForbiddenError, getAdminServerSessionOrThrow, NotAuthenticatedError } from "../../../helpers/getAdminSession";
import { schema, type OutputType } from "./set-active_POST.schema";

/**
 * Shows or hides an organisation's public page (organizations.is_active, which
 * the public profile endpoint already filters on). Members, content and the
 * owner's management screens are untouched; hiding is fully reversible.
 */
export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request);
    const input = schema.parse(superjson.parse(await request.text()));

    const updated = await db
      .updateTable("organizations")
      .set({ isActive: input.isActive, updatedAt: new Date() })
      .where("id", "=", input.organizationId)
      .returning(["id", "isActive"])
      .executeTakeFirst();

    if (!updated) {
      return new Response(superjson.stringify({ error: "Organisation not found." }), { status: 404 });
    }

    return new Response(
      superjson.stringify({ organizationId: updated.id, isActive: updated.isActive } satisfies OutputType),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error updating organization status:", error);
    const status = error instanceof NotAuthenticatedError ? 401 : error instanceof ForbiddenError ? 403 : 500;
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: message }), { status });
  }
}