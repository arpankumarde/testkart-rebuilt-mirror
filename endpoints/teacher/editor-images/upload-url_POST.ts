import superjson from "superjson";
import { ZodError } from "zod";
import { schema, OutputType } from "./upload-url_POST.schema";
import { editorImageKey, editorImageTooLargeMessage } from "../../../helpers/editorImageRules";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { NotAuthenticatedError } from "../../../helpers/getSetServerSession";
import { getPresignedUploadUrl, getPublicUrl } from "../../../helpers/r2Client";
import { getUploadLimits } from "../../../helpers/uploadSizeValidation";

const EXPIRES_IN_SECONDS = 15 * 60;

function reply(body: unknown, status = 200): Response {
  return new Response(superjson.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** A presigned PUT for one editor image, bound to its declared type and exact size. */
export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "teacher") {
      return reply({ error: "Only teachers can upload editor images." }, 403);
    }

    const input = schema.parse(superjson.parse(await request.text()));
    const { richTextImageMaxMb } = await getUploadLimits();
    if (input.sizeBytes > richTextImageMaxMb * 1024 * 1024) {
      return reply({ error: editorImageTooLargeMessage(richTextImageMaxMb) }, 400);
    }

    const key = editorImageKey(input.contentType);
    const uploadUrl = await getPresignedUploadUrl(key, input.contentType, EXPIRES_IN_SECONDS, input.sizeBytes);

    return reply({
      uploadUrl,
      method: "PUT",
      headers: { "Content-Type": input.contentType },
      url: getPublicUrl(key),
      key,
      expiresInSeconds: EXPIRES_IN_SECONDS,
    } satisfies OutputType);
  } catch (error) {
    if (error instanceof NotAuthenticatedError) return reply({ error: "Not authenticated" }, 401);
    if (error instanceof ZodError) return reply({ error: error.errors }, 400);
    console.error("Editor image upload link failed:", error);
    return reply({ error: "Could not create an upload link." }, 500);
  }
}