import { schema, OutputType } from "./complete_POST.schema";
import superjson from "superjson";
import { getUploaderSession } from "../../../helpers/getUploaderSession";
import { completeMultipartUpload, getPublicUrl, listMultipartParts } from "../../../helpers/r2Client";
import { NotAuthenticatedError } from "../../../helpers/getSetServerSession";

export async function handle(request: Request) {
  try {
    // Requires a logged-in user (teacher/student) or a logged-in admin
    await getUploaderSession(request);

    const json = superjson.parse(await request.text());
    const validatedInput = schema.parse(json);

    // Fetch the uploaded parts and their ETags from R2
    const parts = await listMultipartParts(validatedInput.key, validatedInput.uploadId);

    if (parts.length === 0) {
      return new Response(superjson.stringify({ error: "No parts found for this upload" }), { status: 400 });
    }

    // Complete the multipart upload session
    await completeMultipartUpload(validatedInput.key, validatedInput.uploadId, parts);

    const publicUrl = getPublicUrl(validatedInput.key);

    return new Response(superjson.stringify({ publicUrl } satisfies OutputType), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof NotAuthenticatedError) {
      return new Response(superjson.stringify({ error: "User not authenticated" }), { status: 401 });
    }
    
    console.error("Multipart complete failed:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}