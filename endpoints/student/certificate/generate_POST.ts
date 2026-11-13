import superjson from "superjson";

// Certificates stopped being issued on 20-11-2026. Existing certificates still
// download and verify through the download and public endpoints.
export async function handle(_request: Request): Promise<Response> {
  return new Response(
    superjson.stringify({ error: "Certificates are no longer issued." }),
    { status: 410 }
  );
}