import { db } from "../../../helpers/db";
import {
  getAdminServerSessionOrThrow,
  setAdminServerSession,
} from "../../../helpers/getAdminSession";
import { schema, OutputType } from "./update_POST.schema";
import superjson from "superjson";

export async function handle(request: Request): Promise<Response> {
  try {
    const currentAdmin = await getAdminServerSessionOrThrow(request);

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const updated = await db
      .updateTable("admins")
      .set({
        ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
        ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
        ...(input.avatarFileId !== undefined ? { avatarFileId: input.avatarFileId } : {}),
        ...(input.bio !== undefined ? { bio: input.bio } : {}),
        updatedAt: new Date(),
      })
      .where("id", "=", currentAdmin.id)
      .returningAll()
      .executeTakeFirst();

    if (!updated) {
      throw new Error("Admin not found.");
    }

    const adminProfile = {
      id: updated.id,
      email: updated.email,
      fullName: updated.fullName,
      role: updated.role,
      avatarUrl: updated.avatarUrl,
      avatarFileId: updated.avatarFileId,
      bio: updated.bio,
    };

    const response = new Response(
      superjson.stringify({ admin: adminProfile } satisfies OutputType)
    );

    // Re-sign the session cookie so the change takes effect immediately
    // without requiring the admin to log in again.
    await setAdminServerSession(response, adminProfile);

    return response;
  } catch (error) {
    console.error("Error updating admin profile:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 400,
    });
  }
}
