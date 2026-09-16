import superjson from "superjson";
import { ZodError } from "zod";
import { schema, OutputType } from "./upload_POST.schema";
import { getAdminServerSessionOrThrow, NotAuthenticatedError } from "../../../../helpers/getAdminSession";
import { storeSupportAttachment, SupportAttachmentError } from "../../../../helpers/supportAttachmentStorage";

function reply(body: unknown, status = 200): Response {
  return new Response(superjson.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** Stores a file an admin attaches to a support reply and returns its link. */
export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);
    const input = schema.parse(superjson.parse(await request.text()));
    const attachment = await storeSupportAttachment(input);
    return reply(attachment satisfies OutputType);
  } catch (error) {
    if (error instanceof NotAuthenticatedError) return reply({ error: "Not authenticated" }, 401);
    if (error instanceof SupportAttachmentError) return reply({ error: error.message }, 400);
    if (error instanceof ZodError) return reply({ error: error.errors[0]?.message ?? "Invalid upload." }, 400);
    console.error("Admin support attachment upload failed:", error);
    return reply({ error: "The file could not be uploaded. Try again." }, 500);
  }
}