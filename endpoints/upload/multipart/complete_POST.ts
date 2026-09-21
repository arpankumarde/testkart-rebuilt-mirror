import { schema, OutputType } from "./complete_POST.schema";
import superjson from "superjson";
import { getUploaderSession } from "../../../helpers/getUploaderSession";
import { completeMultipartUpload, getPublicUrl, listMultipartParts, r2ObjectExists } from "../../../helpers/r2Client";
import { NotAuthenticatedError } from "../../../helpers/getSetServerSession";
import { isUploadIssuedTo } from "../../../helpers/r2FileOwnership";

const NOT_FOUND_MESSAGE = "This upload is no longer available. Please upload the file again.";

export async function handle(request: Request) {
  try {
    // Requires a logged-in user (teacher/student) or a logged-in admin
    const session = await getUploaderSession(request);

    const json = superjson.parse(await request.text());
    const validatedInput = schema.parse(json);
    const publicUrl = getPublicUrl(validatedInput.key);
    const success = () =>
      new Response(superjson.stringify({ publicUrl } satisfies OutputType), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    const ownerUserId = session.kind === "user" ? session.ownerUserId : null;
    if (!(await isUploadIssuedTo(validatedInput.key, ownerUserId))) {
      return new Response(superjson.stringify({ error: NOT_FOUND_MESSAGE }), { status: 404 });
    }

    // Fetch the uploaded parts and their ETags from R2
    let parts: Awaited<ReturnType<typeof listMultipartParts>>;
    try {
      parts = await listMultipartParts(validatedInput.key, validatedInput.uploadId);
    } catch (error) {
      if (error instanceof Error && error.name === "NoSuchUpload") {
        // A retry after a lost response: the first call already completed the upload.
        if (await r2ObjectExists(validatedInput.key)) return success();
        return new Response(superjson.stringify({ error: NOT_FOUND_MESSAGE }), { status: 404 });
      }
      throw error;
    }

    if (parts.length === 0) {
      return new Response(superjson.stringify({ error: "No parts found for this upload" }), { status: 400 });
    }

    if (validatedInput.partCount !== undefined && parts.length !== validatedInput.partCount) {
      return new Response(
        superjson.stringify({ error: "Some parts of the file have not arrived yet." }),
        { status: 409 }
      );
    }

    // Complete the multipart upload session
    await completeMultipartUpload(validatedInput.key, validatedInput.uploadId, parts);

    return success();
  } catch (error) {
    if (error instanceof NotAuthenticatedError) {
      return new Response(superjson.stringify({ error: "User not authenticated" }), { status: 401 });
    }
    
    console.error("Multipart complete failed:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}
