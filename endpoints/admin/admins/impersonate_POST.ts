import superjson from "superjson";
import { ZodError } from "zod";
import { db } from "../../../helpers/db";
import {
  assertSuperAdmin,
  ForbiddenError,
  getAdminServerSessionOrThrow,
  NotAuthenticatedError,
  startAdminImpersonation,
} from "../../../helpers/getAdminSession";
import { schema, OutputType } from "./impersonate_POST.schema";

function errorResponse(error: string, status: number) {
  return new Response(superjson.stringify({ error }), { status });
}

/**
 * A super admin signs in to the admin panel as another admin, to see what they see. The browser's
 * cookie becomes a two-hour session of that admin; admin/profile/stop-impersonating returns to the
 * super admin's own.
 */
export async function handle(request: Request): Promise<Response> {
  try {
    const admin = await getAdminServerSessionOrThrow(request);
    assertSuperAdmin(admin);
    const { adminId } = schema.parse(superjson.parse(await request.text()));

    if (adminId === admin.id) {
      return errorResponse("You are already signed in as yourself.", 400);
    }

    const target = await db
      .selectFrom("admins")
      .select(["id", "email", "fullName", "role", "avatarUrl", "avatarFileId", "bio", "isActive"])
      .where("id", "=", adminId)
      .executeTakeFirst();

    if (!target) return errorResponse("Admin not found.", 404);
    if (target.isActive === false) {
      return errorResponse("This admin is deactivated. Activate the account before signing in as them.", 400);
    }

    const response = new Response(superjson.stringify({ fullName: target.fullName } satisfies OutputType));
    await startAdminImpersonation(
      response,
      {
        id: target.id,
        email: target.email,
        fullName: target.fullName,
        role: target.role,
        avatarUrl: target.avatarUrl,
        avatarFileId: target.avatarFileId,
        bio: target.bio,
      },
      request,
      admin
    );
    console.log(`Admin ${admin.id} signed in as admin ${target.id}`);
    return response;
  } catch (error) {
    if (error instanceof NotAuthenticatedError) return errorResponse("Not authenticated", 401);
    if (error instanceof ForbiddenError) return errorResponse(error.message, 403);
    if (error instanceof ZodError) return errorResponse("Choose an admin.", 400);
    console.error("Admin impersonation failed:", error);
    return errorResponse("Could not sign in as this admin. Try again.", 500);
  }
}
