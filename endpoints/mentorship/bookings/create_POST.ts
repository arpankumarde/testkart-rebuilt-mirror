import superjson from "superjson";

/**
 * Retired: 1:1 classes are booked only through a paid trial (mentorship/purchase) or a package
 * (mentorship/packages/checkout). Nothing in the app calls this any more.
 */
export async function handle(_request: Request) {
  return new Response(
    superjson.stringify({ error: "Book 1:1 classes from the teacher's booking page." }),
    { status: 410 }
  );
}