import superjson from "superjson";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { hasAdminModule } from "../../../helpers/adminPermissions";
import { ContentExpiryError, relistExpiredContent } from "../../../helpers/contentExpiryServer";
import { EXPIRY_ADMIN_MODULE } from "../../../helpers/contentExpiry";
import { schema, OutputType } from "./relist_POST.schema";

/* Puts an expired item back on sale as an admin cleared for its content type. */
export async function handle(request: Request): Promise<Response> {
  try {
    const admin = await getAdminServerSessionOrThrow(request);
    const input = schema.parse(superjson.parse(await request.text()));
    if (!hasAdminModule(admin.permissions, [EXPIRY_ADMIN_MODULE[input.contentType]])) {
      return new Response(superjson.stringify({ error: "Your admin account cannot manage this content type." }), {
        status: 403,
      });
    }
    const output: OutputType = await relistExpiredContent({ ...input, access: { kind: "admin" } });
    console.log(`${input.contentType} ${input.contentId} relisted after expiry as ${output.visibility} by admin ${admin.id}`);
    return new Response(superjson.stringify(output));
  } catch (error) {
    if (error instanceof ContentExpiryError) {
      return new Response(superjson.stringify({ error: error.message }), { status: error.status });
    }
    console.error("Error relisting expired content as admin:", error);
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    const status =
      error instanceof Error && error.name === "NotAuthenticatedError" ? 401 : error instanceof Error && error.name === "ForbiddenError" ? 403 : 500;
    return new Response(superjson.stringify({ error: message }), { status });
  }
}