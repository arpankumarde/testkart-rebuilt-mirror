import superjson from "superjson";
import { ZodError } from "zod";
import { schema, OutputType } from "./upload_POST.schema";
import { getServerUserSession } from "../../../../helpers/getServerUserSession";
import { NotAuthenticatedError } from "../../../../helpers/getSetServerSession";
import { storeSupportAttachment, SupportAttachmentError } from "../../../../helpers/supportAttachmentStorage";

function reply(body: unknown, status = 200): Response {
  return new Response(superjson.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** Stores a file a teacher attaches to a support message and returns its link. */
export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "teacher" && user.role !== "admin") {
      return reply({ error: "Unauthorized" }, 403);
    }
    const input = schema.parse(superjson.parse(await request.text()));
    const attachment = await storeSupportAttachment(input);
    return reply(attachment satisfies OutputType);
  } catch (error) {
    if (error instanceof NotAuthenticatedError) return reply({ error: "Not authenticated" }, 401);
    if (error instanceof SupportAttachmentError) return reply({ error: error.message }, 400);
    if (error instanceof ZodError) return reply({ error: error.errors[0]?.message ?? "Invalid upload." }, 400);
    console.error("Teacher support attachment upload failed:", error);
    return reply({ error: "The file could not be uploaded. Try again." }, 500);
  }
}