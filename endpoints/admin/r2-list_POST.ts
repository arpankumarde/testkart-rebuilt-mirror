import { schema, OutputType } from "./r2-list_POST.schema";
import superjson from "superjson";
import { ListObjectsV2Command, ListObjectsV2CommandOutput } from "@aws-sdk/client-s3";
import { getR2Client } from "../../helpers/r2Client";
import { R2_BUCKET_NAME } from "../../helpers/_publicConfigs";
import {
  getAdminServerSessionOrThrow,
  NotAuthenticatedError,
} from "../../helpers/getAdminSession";

export async function handle(request: Request) {
  try {
            // 1. Authenticate the admin user
    await getAdminServerSessionOrThrow(request);

    // 2. Parse request parameters
    const json = superjson.parse(await request.text());
    const result = schema.parse(json);

    // 3. Setup R2 client and pagination loop variables
    const client = getR2Client();
    const files: Array<{ key: string; size: number }> = [];
    let isTruncated = true;
    let continuationToken: string | undefined = undefined;

    // Safety limit to avoid unbounded memory usage, just in case
    const MAX_ITEMS = 20000;

    // 4. Paginate through R2 objects
    while (isTruncated && files.length < MAX_ITEMS) {
      const command = new ListObjectsV2Command({
        Bucket: R2_BUCKET_NAME,
        Prefix: result.prefix,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      });

      const response = await client.send(command) as ListObjectsV2CommandOutput;

      if (response.Contents) {
        for (const item of response.Contents) {
          if (item.Key) {
            files.push({
              key: item.Key,
              size: item.Size ?? 0,
            });
          }
        }
      }

      isTruncated = response.IsTruncated ?? false;
      continuationToken = response.NextContinuationToken;
    }

    // 5. Construct and return response
    const output: OutputType = {
      totalFiles: files.length,
      files,
      truncated: isTruncated,
    };

    return new Response(superjson.stringify(output satisfies OutputType), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Failed to list R2 objects:", error);
    const status = error instanceof NotAuthenticatedError ? 401 : 400;
    return new Response(
      superjson.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status, headers: { "Content-Type": "application/json" } }
    );
  }
}