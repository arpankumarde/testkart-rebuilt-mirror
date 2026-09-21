import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, OutputType } from "./toggle-status_POST.schema";
import { sendTemplateEmail } from "../../../helpers/sendTemplateEmail";
import superjson from "superjson";

export async function handle(request: Request): Promise<Response> {
  try {
    const admin = await getAdminServerSessionOrThrow(request);
    const json = superjson.parse(await request.text());
    const { userId, isActive } = schema.parse(json);

    if (admin.id === userId) {
      return new Response(
        superjson.stringify({ error: "Admins cannot change their own status." }),
        { status: 400 }
      );
    }

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

    await db
      .updateTable("users")
      .set({ isActive })
      .where("id", "=", userId)
      .execute();

    // Send email notification
    try {
      const targetUser = await db.selectFrom("users")
        .select(["email", "displayName"])
        .where("id", "=", userId)
        .executeTakeFirst();
        
      if (targetUser?.email) {
        if (!isActive) {
          await sendTemplateEmail("account_suspended", targetUser.email, { displayName: targetUser.displayName });
        } else {
          await sendTemplateEmail("account_reactivated", targetUser.email, { displayName: targetUser.displayName });
        }
      }
    } catch (emailError) {
      console.error("Error sending account status email:", emailError);
    }

    const output: OutputType = {
      success: true,
      userId,
      isActive,
    };

    return new Response(superjson.stringify(output), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error toggling user status:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 500,
    });
  }
}