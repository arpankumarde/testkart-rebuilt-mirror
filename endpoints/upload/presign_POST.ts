import { schema, OutputType } from "./presign_POST.schema";
import superjson from "superjson";
import { getUploaderSession } from "../../helpers/getUploaderSession";
import { getPresignedUploadUrl, getPublicUrl } from "../../helpers/r2Client";
import { NotAuthenticatedError } from "../../helpers/getSetServerSession";
import { validateUploadSize, validateUploadType } from "../../helpers/uploadSizeValidation";

export async function handle(request: Request) {
  try {
    // Requires a logged-in user (teacher/student) or a logged-in admin
    await getUploaderSession(request);

    const json = superjson.parse(await request.text());
    const validatedInput = schema.parse(json);

    const typeValidationResponse = validateUploadType(
      validatedInput.folder,
      validatedInput.contentType,
      validatedInput.fileName
    );
    if (typeValidationResponse) return typeValidationResponse;

    // Validate file size against upload limits
    const sizeValidationResponse = await validateUploadSize(
      validatedInput.folder,
      validatedInput.contentType,
      validatedInput.fileSize
    );
    if (sizeValidationResponse) return sizeValidationResponse;

    // Sanitize the file name to prevent tricky paths or encoding issues
    const safeFileName = validatedInput.fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
    
    // Generate a unique key with a UUID and file extension
    const sanitizedFolder = validatedInput.folder.replace(/^\/+/, '').replace(/\/+$/, '');
    const dotIndex = safeFileName.lastIndexOf('.');
    const ext = dotIndex > 0 ? safeFileName.substring(dotIndex + 1) : null;
    const key = ext ? `${sanitizedFolder}/${crypto.randomUUID()}.${ext}` : `${sanitizedFolder}/${crypto.randomUUID()}`;

    // Get the presigned PUT URL and the public CDN URL
    const presignedUrl = await getPresignedUploadUrl(key, validatedInput.contentType);
    const publicUrl = getPublicUrl(key);

    return new Response(superjson.stringify({ presignedUrl, key, publicUrl } satisfies OutputType), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof NotAuthenticatedError) {
      return new Response(superjson.stringify({ error: "User not authenticated" }), { status: 401 });
    }
    
    console.error("Presign generation failed:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}