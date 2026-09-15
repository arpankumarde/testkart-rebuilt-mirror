import { schema, OutputType } from "./delete_POST.schema";
import superjson from "superjson";
import { getUploaderSession } from "../../helpers/getUploaderSession";
import { deleteFromR2 } from "../../helpers/r2Client";
import { NotAuthenticatedError } from "../../helpers/getSetServerSession";

export async function handle(request: Request) {
  try {
    const session = await getUploaderSession(request);

    // Only teachers and admins can delete R2 files through this endpoint.
    // An admin-panel session is already privileged, so only the user-session
    // branch carries a role to check.
    if (
      session.kind === "user" &&
      session.user.role !== "teacher" &&
      session.user.role !== "admin"
    ) {
      return new Response(superjson.stringify({ error: "Forbidden: You do not have permission to delete files." }), { status: 403 });
    }

    const json = superjson.parse(await request.text());
    const validatedInput = schema.parse(json);

    await deleteFromR2(validatedInput.key);

    return new Response(superjson.stringify({ success: true, message: "File deleted successfully" } satisfies OutputType), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof NotAuthenticatedError) {
      return new Response(superjson.stringify({ error: "User not authenticated" }), { status: 401 });
    }
    
    console.error("Delete from R2 failed:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}