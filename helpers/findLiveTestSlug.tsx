import { db } from "./db";

/**
 * The public slug of an active live test, from its id or an existing slug.
 * Old /mock-test/live/:id links and id-only server flows resolve through here.
 */
export async function findLiveTestSlug(idOrSlug: number | string): Promise<string | null> {
  const isId = typeof idOrSlug === "number" || /^\d+$/.test(idOrSlug);
  const row = await db
    .selectFrom("liveTests")
    .innerJoin("mockTests", "mockTests.id", "liveTests.mockTestId")
    .select("mockTests.slug")
    .where((eb) =>
      isId ? eb("liveTests.id", "=", Number(idOrSlug)) : eb("mockTests.slug", "=", String(idOrSlug))
    )
    .where("liveTests.isActive", "=", true)
    .executeTakeFirst();
  return row?.slug ?? null;
}
