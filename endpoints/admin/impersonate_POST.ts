import { schema, OutputType } from "./impersonate_POST.schema";
import superjson from 'superjson';
import { db } from "../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../helpers/getAdminSession";
import { setServerSession, SessionExpirationSeconds } from "../../helpers/getSetServerSession";
import { randomBytes } from "crypto";

export async function handle(request: Request): Promise<Response> {
  try {
        const adminProfile = await getAdminServerSessionOrThrow(request, ['super_admin', 'admin']);

    const json = superjson.parse(await request.text());
    const { userId } = schema.parse(json);

    const targetUser = await db
      .selectFrom("users")
      .select(["id", "role", "isActive"])
      .where("id", "=", userId)
      .executeTakeFirst();

    if (!targetUser) {
      return new Response(superjson.stringify({ error: "User not found." } satisfies OutputType), { status: 404 });
    }

    if (targetUser.role === "admin") {
      return new Response(superjson.stringify({ error: "Cannot impersonate another admin." } satisfies OutputType), { status: 400 });
    }

    if (!targetUser.isActive) {
      return new Response(superjson.stringify({ error: "Cannot impersonate an inactive user." } satisfies OutputType), { status: 400 });
    }

    const now = new Date();
    const sessionId = randomBytes(32).toString("hex");
    const expiresAt = new Date(now.getTime() + SessionExpirationSeconds * 1000);

    // Create session record in database with both userId and impersonatorAdminId
    await db
      .insertInto("sessions")
      .values({
        id: sessionId,
        userId: targetUser.id,
        createdAt: now,
        lastAccessed: now,
        expiresAt: expiresAt,
        impersonatorAdminId: adminProfile.id,
      })
      .execute();

    console.log(`Admin ${adminProfile.id} is impersonating user ${targetUser.id}`);

    const session = {
      id: sessionId,
      createdAt: now.getTime(),
      lastAccessed: now.getTime(),
      impersonatorAdminId: adminProfile.id,
    };

    const response = new Response(superjson.stringify({ success: true } satisfies OutputType), {
      headers: { "Content-Type": "application/json" },
    });

    await setServerSession(response, session);

    return response;

  } catch (error) {
    console.error("Impersonation failed:", error);
    if (error instanceof Error && error.name === 'NotAuthenticatedError') {
        return new Response(superjson.stringify({ error: "Admin not authenticated." }), { status: 401 });
    }
    return new Response(superjson.stringify({ error: error instanceof Error ? error.message : "An unexpected error occurred." }), { status: 400 });
  }
}