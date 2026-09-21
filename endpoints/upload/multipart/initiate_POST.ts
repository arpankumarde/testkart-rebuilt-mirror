import { schema, OutputType } from "./initiate_POST.schema";
import superjson from "superjson";
import { getUploaderSession } from "../../../helpers/getUploaderSession";
import { createMultipartUpload, getPresignedPartUrl, getPublicUrl } from "../../../helpers/r2Client";
import { NotAuthenticatedError } from "../../../helpers/getSetServerSession";
import { validateUploadSize, validateUploadType } from "../../../helpers/uploadSizeValidation";
import { recordUploadedFile } from "../../../helpers/r2FileOwnership";

const DEFAULT_PART_SIZE = 50 * 1024 * 1024; // 50 MB
const MAX_PART_COUNT = 10000;

export async function handle(request: Request) {
  try {
    // Requires a logged-in user (teacher/student) or a logged-in admin
    const session = await getUploaderSession(request);

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

    const partSize = validatedInput.partSize ?? DEFAULT_PART_SIZE;
    const numParts = Math.ceil(validatedInput.fileSize / partSize);
    if (numParts > MAX_PART_COUNT) {
      return new Response(superjson.stringify({ error: "This file needs larger upload parts." }), { status: 400 });
    }

    // Sanitize the file name to prevent tricky paths or encoding issues
    const safeFileName = validatedInput.fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
    
    // Generate a unique key with a UUID and file extension
    const sanitizedFolder = validatedInput.folder.replace(/^\/+/, '').replace(/\/+$/, '');
    const dotIndex = safeFileName.lastIndexOf('.');
    const ext = dotIndex > 0 ? safeFileName.substring(dotIndex + 1) : null;
    const key = ext ? `${sanitizedFolder}/${crypto.randomUUID()}.${ext}` : `${sanitizedFolder}/${crypto.randomUUID()}`;

    // Create the multipart upload session
    const uploadId = await createMultipartUpload(key, validatedInput.contentType);

    const parts: Array<{ partNumber: number; presignedUrl: string }> = [];

    // Part numbers must be 1-indexed for S3
    for (let i = 1; i <= numParts; i++) {
      const presignedUrl = await getPresignedPartUrl(key, uploadId, i);
      parts.push({ partNumber: i, presignedUrl });
    }

    const publicUrl = getPublicUrl(key);

    // Recorded so only this uploader can later delete the key
    await recordUploadedFile(key, session.kind === "user" ? session.ownerUserId : null);

    return new Response(superjson.stringify({ uploadId, key, publicUrl, partSize, parts } satisfies OutputType), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof NotAuthenticatedError) {
      return new Response(superjson.stringify({ error: "User not authenticated" }), { status: 401 });
    }
    
    console.error("Multipart initiate failed:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}