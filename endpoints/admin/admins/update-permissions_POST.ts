import superjson from "superjson";
import { sql } from "kysely";
import { ZodError } from "zod";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { normalizeAdminPermissions } from "../../../helpers/adminPermissions";
import { schema, OutputType } from "./update-permissions_POST.schema";

function errorResponse(error: string, status: number) {
  return new Response(superjson.stringify({ error }), { status });
}

export async function handle(request: Request) {
  try {
    const session = await getAdminServerSessionOrThrow(request);
    const input = schema.parse(superjson.parse(await request.text()));

    if (session.id === input.adminId) {
      return errorResponse("You cannot change your own access. Ask another admin with Admins and access.", 400);
    }

    const permissions = normalizeAdminPermissions(input.permissions);

    const outcome = await db.transaction().execute(async (trx) => {
      const target = await trx
        .selectFrom("admins")
        .select(["id"])
        .where("id", "=", input.adminId)
        .forUpdate()
        .executeTakeFirst();
      if (!target) return "not_found" as const;

      if (!permissions.includes("admins")) {
        const others = await trx
          .selectFrom("admins")
          .select((eb) => eb.fn.countAll<string>().as("count"))
          .where("id", "!=", input.adminId)
          .where("isActive", "=", true)
          .where(sql<boolean>`'admins' = ANY(permissions)`)
          .executeTakeFirst();
        if (Number(others?.count ?? 0) === 0) return "last_manager" as const;
      }

      await trx
        .updateTable("admins")
        .set({ permissions, updatedAt: new Date() })
        .where("id", "=", input.adminId)
        .execute();
      return "updated" as const;
    });

    if (outcome === "not_found") return errorResponse("Admin not found", 404);
    if (outcome === "last_manager") {
      return errorResponse("At least one active admin must keep Admins and access.", 400);
    }

    return new Response(superjson.stringify({ success: true, permissions } satisfies OutputType));
  } catch (error) {
    if (error instanceof ZodError) return errorResponse("Invalid access list", 400);
    if (error instanceof Error && error.name === "NotAuthenticatedError") {
      return errorResponse("Not authenticated", 401);
    }
    if (error instanceof Error && error.name === "ForbiddenError") {
      return errorResponse(error.message, 403);
    }
    console.error("Admin permissions update failed:", error);
    return errorResponse("Could not update access. Try again.", 500);
  }
}