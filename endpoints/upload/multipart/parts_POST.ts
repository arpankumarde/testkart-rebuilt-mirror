import { schema, OutputType } from "./parts_POST.schema";
import superjson from "superjson";
import { getUploaderSession } from "../../../helpers/getUploaderSession";
import { getPresignedPartUrl, listMultipartPartsWithSize } from "../../../helpers/r2Client";
import { NotAuthenticatedError } from "../../../helpers/getSetServerSession";
import { isUploadIssuedTo } from "../../../helpers/r2FileOwnership";

const NOT_FOUND_MESSAGE = "This upload is no longer available. Please upload the file again.";

// Lets an interrupted upload continue: reports which parts R2 already holds and
// issues fresh URLs for the rest, so expired URLs never strand an upload.
export async function handle(request: Request) {
  try {
    const session = await getUploaderSession(request);

    const json = superjson.parse(await request.text());
    const { key, uploadId, partNumbers } = schema.parse(json);

    const ownerUserId = session.kind === "user" ? session.ownerUserId : null;
    if (!(await isUploadIssuedTo(key, ownerUserId))) {
      return new Response(superjson.stringify({ error: NOT_FOUND_MESSAGE }), { status: 404 });
    }

    let stored: Awaited<ReturnType<typeof listMultipartPartsWithSize>>;
    try {
      stored = await listMultipartPartsWithSize(key, uploadId);
    } catch (error) {
      if (error instanceof Error && error.name === "NoSuchUpload") {
        return new Response(superjson.stringify({ error: NOT_FOUND_MESSAGE }), { status: 404 });
      }
      throw error;
    }

    const storedNumbers = new Set(stored.map((part) => part.PartNumber));
    const missing = [...new Set(partNumbers)].filter((partNumber) => !storedNumbers.has(partNumber));
    const urls = await Promise.all(
      missing.map(async (partNumber) => ({
        partNumber,
        presignedUrl: await getPresignedPartUrl(key, uploadId, partNumber),
      }))
    );

    const output: OutputType = {
      uploadedParts: stored.map((part) => ({ partNumber: part.PartNumber, size: part.Size })),
      urls,
    };
    return new Response(superjson.stringify(output), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof NotAuthenticatedError) {
      return new Response(superjson.stringify({ error: "User not authenticated" }), { status: 401 });
    }

    console.error("Multipart parts lookup failed:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}
