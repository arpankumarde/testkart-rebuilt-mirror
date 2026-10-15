import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { slugify } from "../../../helpers/slugify";
import { evaluateScrapedPlace, buildLocationString } from "../../../helpers/organizationImportScoring";
import { schema, OutputType, BulkImportSkipReason } from "./bulk-import_POST.schema";
import superjson from "superjson";

/**
 * Bulk-imports scraped business listings (Google Maps / Apify today, any
 * similar source later) as "unclaimed" organisations - no human review of
 * individual rows. Quality control happens entirely through
 * evaluateScrapedPlace: closed businesses, nameless/generic placeholder pins,
 * and listings with no contact info at all (so nobody could ever claim them)
 * are skipped; everything else that clears the bar goes live immediately.
 *
 * Idempotent: re-running this with a fresh scrape of the same places updates
 * the existing rows (matched by sourcePlaceId) instead of duplicating them,
 * and never touches a row that has already been claimed by a real teacher.
 */
export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    let imported = 0;
    let updated = 0;
    const skippedReasons: Partial<Record<BulkImportSkipReason, number>> = {};
    const skippedTitles: { title: string | null; reason: BulkImportSkipReason }[] = [];

    await db.transaction().execute(async (trx) => {
      for (const place of input.places) {
        const evaluation = evaluateScrapedPlace(place);
        if (!evaluation.accept) {
          skippedReasons[evaluation.reason] = (skippedReasons[evaluation.reason] ?? 0) + 1;
          skippedTitles.push({ title: place.title ?? null, reason: evaluation.reason });
          continue;
        }

        const title = place.title!.trim();
        const phoneNumber = place.phoneUnformatted || place.phone || null;
        const websiteUrl = place.website || null;
        const emails = (place.emails ?? []).filter((e) => !!e && e.trim().length > 0);
        const location = buildLocationString(place);
        const specialties = place.categories && place.categories.length > 0 ? place.categories.slice(0, 20) : null;

        // Already imported before (same sourcePlaceId)? Update it in place,
        // but never overwrite a row a real teacher has since claimed - their
        // edits are the source of truth from that point on.
        const existing = await trx
          .selectFrom("organizations")
          .select(["id", "claimStatus"])
          .where("sourcePlaceId", "=", place.placeId)
          .executeTakeFirst();

        if (existing) {
          if (existing.claimStatus === "claimed") {
            continue; // leave claimed orgs alone entirely
          }
          await trx
            .updateTable("organizations")
            .set({
              name: title,
              description: place.categoryName ? `${place.categoryName}${location ? ` in ${location}` : ""}.` : null,
              location,
              websiteUrl,
              phoneNumber,
              contactEmails: emails.length > 0 ? JSON.stringify(emails) : null,
              specialties: specialties ? JSON.stringify(specialties) : null,
              sourceSearchTerm: place.searchString ?? null,
              importedAt: new Date(),
              updatedAt: new Date(),
            })
            .where("id", "=", existing.id)
            .execute();
          updated += 1;
          continue;
        }

        // New row: uniquify the slug the same way teacher-created orgs do.
        const baseSlug = slugify(title) || "organisation";
        let slug = baseSlug;
        let suffix = 1;
        for (;;) {
          const slugTaken = await trx
            .selectFrom("organizations")
            .select(["id"])
            .where("slug", "=", slug)
            .executeTakeFirst();
          if (!slugTaken) break;
          suffix += 1;
          slug = `${baseSlug}-${suffix}`;
        }

        await trx
          .insertInto("organizations")
          .values({
            name: title,
            slug,
            orgType: input.orgType,
            description: place.categoryName ? `${place.categoryName}${location ? ` in ${location}` : ""}.` : null,
            location,
            websiteUrl,
            phoneNumber,
            contactEmails: emails.length > 0 ? JSON.stringify(emails) : null,
            specialties: specialties ? JSON.stringify(specialties) : null,
            createdByTeacherId: null,
            claimStatus: "unclaimed",
            source: input.source,
            sourcePlaceId: place.placeId,
            sourceSearchTerm: place.searchString ?? null,
            importedAt: new Date(),
          })
          .execute();
        imported += 1;
      }
    });

    return new Response(
      superjson.stringify({
        totalReceived: input.places.length,
        imported,
        updated,
        skipped: input.places.length - imported - updated,
        skippedReasons,
        skippedTitles,
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("Failed to bulk-import organizations:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: "Failed to bulk-import organisations.", details: errorMessage }),
      { status: 500 }
    );
  }
}
