import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, OutputType } from "./toggle-verified_POST.schema";
import { sendTemplateEmail } from "../../../helpers/sendTemplateEmail";
import superjson from "superjson";

export async function handle(request: Request): Promise<Response> {
  try {
    // 1. Authenticate Admin
    await getAdminServerSessionOrThrow(request);

    // 2. Parse and Validate Input
    const json = superjson.parse(await request.text());
    const { userId, isVerified } = schema.parse(json);

    // 3. Verify Target User Exists
    const user = await db
      .selectFrom("users")
      .select("id")
      .where("id", "=", userId)
      .executeTakeFirst();

    if (!user) {
      return new Response(
        superjson.stringify({ error: "User not found." }),
        { status: 404 }
      );
    }

    // 4. Update the isVerified field
    await db
      .updateTable("users")
      .set({ isVerified })
      .where("id", "=", userId)
      .execute();

    // Send email notification on verification
    if (isVerified) {
      try {
        const targetUser = await db
          .selectFrom("users")
          .select(["email", "displayName", "role"])
          .where("id", "=", userId)
          .executeTakeFirst();

        if (targetUser?.email && targetUser.role === "teacher") {
          await sendTemplateEmail("verified_badge_granted", targetUser.email, { displayName: targetUser.displayName });
        }
      } catch (emailError) {
        console.error("Error sending verified badge email:", emailError);
      }
    }

    // 5. Return Success Response
    const output: OutputType = {
      success: true,
      userId,
      isVerified,
    };

    return new Response(superjson.stringify(output), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error toggling user verified status:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 500,
    });
  }
}