import { db } from "../../helpers/db";
import { schema } from "./establish_session_POST.schema";
import { setServerSession } from "../../helpers/getSetServerSession";
import { randomBytes } from "crypto";

export async function handle(request: Request) {
  try {
    const json = await request.json();

    const { tempToken } = schema.parse(json);

    // We reuse the session table for temporary tokens, with a much shorter lifetime
    const tempSession = await db
      .selectFrom("sessions")
      .selectAll()
      .where("id", "=", tempToken)
      .limit(1)
      .executeTakeFirst();

    if (!tempSession) {
      return Response.json(
        { error: "Invalid or expired token" },
        { status: 400 }
      );
    }

    // Check if session is expired
    const now = new Date();
    if (tempSession.expiresAt < now) {
      // Clean up expired session
      await db
        .deleteFrom("sessions")
        .where("id", "=", tempSession.id)
        .execute();

      return Response.json({ error: "Token has expired" }, { status: 400 });
    }

    // Fetch the user by userId from the session record
    const user = await db
      .selectFrom("users")
      .selectAll()
      .where("id", "=", tempSession.userId)
      .executeTakeFirst();

    if (!user) {
      return Response.json({ error: "User not found" }, { status: 400 });
    }

    // Delete the temp session immediately to make it single-use
    await db.deleteFrom("sessions").where("id", "=", tempSession.id).execute();

    // Create a new proper session with a different session ID
    const newSessionId = randomBytes(32).toString("hex");
    const sessionCreatedAt = new Date();
    const sessionExpiresAt = new Date(
      sessionCreatedAt.getTime() + 7 * 24 * 60 * 60 * 1000
    ); // 7 days

    await db
      .insertInto("sessions")
      .values({
        id: newSessionId,
        userId: user.id,
        createdAt: sessionCreatedAt,
        lastAccessed: sessionCreatedAt,
        expiresAt: sessionExpiresAt,
      })
      .execute();

    // Create response with user data
    // Check if the user was created very recently (within the last 2 minutes).
    // This works because the temp session is created right after the OAuth account is created,
    // and establish_session is called seconds later.
    const isNewUser = user.createdAt
      ? now.getTime() - new Date(user.createdAt).getTime() < 2 * 60 * 1000
      : false;

    const userData = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      role: user.role,
      mobileNumber: user.mobileNumber,
      mobileVerified: user.mobileVerified,
      onboardingCompleted: user.onboardingCompleted,
    };

    const response = Response.json({
      user: userData,
      success: true,
      isNewUser,
      redirectTo: tempSession.redirectToPath || undefined,
    });

    // Set the session cookie with the new session ID
    await setServerSession(response, {
      id: newSessionId,
      createdAt: sessionCreatedAt.getTime(),
      lastAccessed: sessionCreatedAt.getTime(),
    });

    return response;
  } catch (error) {
    if (error instanceof Error) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
