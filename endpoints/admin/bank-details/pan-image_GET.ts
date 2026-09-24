import { schema } from "./pan-image_GET.schema";
import { db } from "../../../helpers/db";
import { ForbiddenError, getAdminServerSessionOrThrow, NotAuthenticatedError } from "../../../helpers/getAdminSession";
import { kycImageRedirect } from "../../../helpers/kycImage";

export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);
    const { id } = schema.parse({ id: new URL(request.url).searchParams.get("id") });

    const row = await db
      .selectFrom("teacherBankDetails")
      .select("panCardImageBase64")
      .where("id", "=", id)
      .executeTakeFirst();

    return kycImageRedirect(row?.panCardImageBase64);
  } catch (error) {
    if (error instanceof NotAuthenticatedError) {
      return new Response("Not authenticated", { status: 401, headers: { "Cache-Control": "no-store" } });
    }
    if (error instanceof ForbiddenError) {
      return new Response(error.message, { status: 403, headers: { "Cache-Control": "no-store" } });
    }
    console.error("Error loading teacher PAN image:", error);
    return new Response("Could not load the image", { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}