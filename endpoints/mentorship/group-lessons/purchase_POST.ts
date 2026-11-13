import superjson from "superjson";

/** Standalone group lessons were retired for live courses on 18-11-2026 (see live-courses/purchase). */
export async function handle(_request: Request) {
  return new Response(
    superjson.stringify({ error: "Failed to initiate payment.", details: "Group lessons are no longer sold. Look for a live course instead." }),
    { status: 410 }
  );
}
