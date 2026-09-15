import { schema, OutputType } from "./upload-resume_POST.schema";
import superjson from "superjson";
import { getPresignedUploadUrl, getPublicUrl } from "../../helpers/r2Client";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_CONTENT_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
];

export async function handle(request: Request) {
  try {
    const json = superjson.parse(await request.text());
    const validatedInput = schema.parse(json);

    if (!ALLOWED_CONTENT_TYPES.includes(validatedInput.contentType)) {
      return new Response(
        superjson.stringify({
          error: "Invalid file type. Only PDF, DOC, DOCX, JPG, and PNG are allowed.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (validatedInput.fileSize > MAX_FILE_SIZE) {
      return new Response(
        superjson.stringify({ error: "File size exceeds the 10MB limit." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const safeFileName = validatedInput.fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
    const dotIndex = safeFileName.lastIndexOf(".");
    const ext = dotIndex > 0 ? safeFileName.substring(dotIndex + 1) : null;
    const key = ext
      ? `resumes/${crypto.randomUUID()}.${ext}`
      : `resumes/${crypto.randomUUID()}`;

    const presignedUrl = await getPresignedUploadUrl(
      key,
      validatedInput.contentType
    );
    const publicUrl = getPublicUrl(key);

    return new Response(
      superjson.stringify({
        presignedUrl,
        key,
        publicUrl,
      } satisfies OutputType),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Presign generation failed:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
}