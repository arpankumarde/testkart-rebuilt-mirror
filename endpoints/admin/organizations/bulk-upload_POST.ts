import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { slugify } from "../../../helpers/slugify";
import { schema, OutputType } from "./bulk-upload_POST.schema";
import superjson from "superjson";

/**
 * Bulk-uploads a flat, CSV-shaped list of organisations (built by the admin
 * client from a CSV/XLSX file) as "unclaimed" organisations - no per-row
 * human review. Designed to handle large datasets (tens of thousands of
 * rows, e.g. an official college/university registry) in one request:
 * - Slugs are uniquified using one up-front query of all existing slugs
 *   (not one query per row).
 * - For college rows carrying an `affiliatedUniversityName`, matching
 *   universities are resolved (case-insensitive) in bulk; any name with no
 *   match is created as a new unclaimed university row.
 * - Rows with an `externalId` are idempotent: re-uploading the same CSV
 *   updates the existing unclaimed row instead of duplicating it, and never
 *   touches a row a teacher has since claimed.
 * - Inserts happen in chunks inside one transaction.
 */
export async function handle(request: Request) {
  try {
    await getAdminServerSessionOrThrow(request);

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const skippedRows: OutputType["skippedRows"] = [];
    const validRows = input.rows
      .map((row, index) => ({ row, index }))
      .filter(({ row, index }) => {
        if (!row.name || row.name.trim().length === 0) {
          skippedRows.push({ row: index, name: row.name ?? null, reason: "missing_name" });
          return false;
        }
        return true;
      });

    let imported = 0;
    let updated = 0;
    let universitiesCreated = 0;

    await db.transaction().execute(async (trx) => {
      // --- 1. Resolve/create affiliated universities in bulk ---
      const universityNames = Array.from(
        new Set(
          validRows
            .map(({ row }) => row.affiliatedUniversityName?.trim())
            .filter((n): n is string => !!n && n.length > 0)
        )
      );

      const universityIdByLowerName = new Map<string, string>();
      if (universityNames.length > 0) {
        const existingUniversities = await trx
          .selectFrom("organizations")
          .select(["id", "name"])
          .where("orgType", "=", "university")
          .execute();
        for (const u of existingUniversities) {
          universityIdByLowerName.set(u.name.trim().toLowerCase(), u.id);
        }

        const existingSlugsForUni = new Set(
          (await trx.selectFrom("organizations").select(["slug"]).execute()).map((r) => r.slug)
        );

        const newUniversityRows: {
          name: string;
          slug: string;
          orgType: "university";
          claimStatus: "unclaimed";
          source: string;
          isActive: true;
        }[] = [];

        for (const name of universityNames) {
          const lower = name.toLowerCase();
          if (universityIdByLowerName.has(lower)) continue;

          const baseSlug = slugify(name) || "university";
          let slug = baseSlug;
          let suffix = 1;
          while (existingSlugsForUni.has(slug)) {
            suffix += 1;
            slug = `${baseSlug}-${suffix}`;
          }
          existingSlugsForUni.add(slug);

          newUniversityRows.push({
            name,
            slug,
            orgType: "university",
            claimStatus: "unclaimed",
            source: input.source,
            isActive: true,
          });
        }

        for (let i = 0; i < newUniversityRows.length; i += 500) {
          const chunk = newUniversityRows.slice(i, i + 500);
          if (chunk.length === 0) continue;
          const inserted = await trx
            .insertInto("organizations")
            .values(chunk)
            .returning(["id", "name"])
            .execute();
          for (const row of inserted) {
            universityIdByLowerName.set(row.name.trim().toLowerCase(), row.id);
          }
          universitiesCreated += inserted.length;
        }
      }

      // --- 2. Resolve existing rows by externalId (idempotent upsert) ---
      const externalIds = Array.from(
        new Set(
          validRows
            .map(({ row }) => row.externalId?.trim())
            .filter((v): v is string => !!v && v.length > 0)
            .map((v) => `csv:${v}`)
        )
      );

      const existingByExternalId = new Map<string, { id: string; claimStatus: string }>();
      if (externalIds.length > 0) {
        const existing = await trx
          .selectFrom("organizations")
          .select(["id", "claimStatus", "sourcePlaceId"])
          .where("sourcePlaceId", "in", externalIds)
          .execute();
        for (const e of existing) {
          if (e.sourcePlaceId) existingByExternalId.set(e.sourcePlaceId, { id: e.id, claimStatus: e.claimStatus });
        }
      }

      // --- 3. Uniquify slugs for brand-new rows up front ---
      const existingSlugs = new Set(
        (await trx.selectFrom("organizations").select(["slug"]).execute()).map((r) => r.slug)
      );

      type NewRow = {
        name: string;
        slug: string;
        orgType: (typeof validRows)[number]["row"]["orgType"];
        description: string | null;
        location: string | null;
        websiteUrl: string | null;
        phoneNumber: string | null;
        foundedYear: number | null;
        affiliatedUniversityId: string | null;
        contactEmails: string | null;
        specialties: string | null;
        createdByTeacherId: null;
        claimStatus: "unclaimed";
        source: string;
        sourcePlaceId: string | null;
        importedAt: Date;
      };
      const newRows: NewRow[] = [];

      for (const { row } of validRows) {
        const externalKey = row.externalId?.trim() ? `csv:${row.externalId.trim()}` : null;
        const existing = externalKey ? existingByExternalId.get(externalKey) : undefined;

        const affiliatedUniversityId = row.affiliatedUniversityName?.trim()
          ? universityIdByLowerName.get(row.affiliatedUniversityName.trim().toLowerCase()) ?? null
          : null;

        const contactEmailsJson = row.contactEmails
          ? JSON.stringify(
              row.contactEmails
                .split(",")
                .map((e) => e.trim())
                .filter((e) => e.length > 0)
            )
          : null;
        const specialtiesJson = row.specialties
          ? JSON.stringify(
              row.specialties
                .split(",")
                .map((s) => s.trim())
                .filter((s) => s.length > 0)
            )
          : null;

        if (existing) {
          if (existing.claimStatus === "claimed") {
            continue; // never touch a claimed org
          }
          await trx
            .updateTable("organizations")
            .set({
              name: row.name,
              orgType: row.orgType,
              description: row.description ?? null,
              location: row.location ?? null,
              websiteUrl: row.websiteUrl ?? null,
              phoneNumber: row.phoneNumber ?? null,
              foundedYear: row.foundedYear ?? null,
              affiliatedUniversityId,
              contactEmails: contactEmailsJson,
              specialties: specialtiesJson,
              importedAt: new Date(),
              updatedAt: new Date(),
            })
            .where("id", "=", existing.id)
            .execute();
          updated += 1;
          continue;
        }

        const baseSlug = slugify(row.name) || "organisation";
        let slug = baseSlug;
        let suffix = 1;
        while (existingSlugs.has(slug)) {
          suffix += 1;
          slug = `${baseSlug}-${suffix}`;
        }
        existingSlugs.add(slug);

        newRows.push({
          name: row.name,
          slug,
          orgType: row.orgType,
          description: row.description ?? null,
          location: row.location ?? null,
          websiteUrl: row.websiteUrl ?? null,
          phoneNumber: row.phoneNumber ?? null,
          foundedYear: row.foundedYear ?? null,
          affiliatedUniversityId,
          contactEmails: contactEmailsJson,
          specialties: specialtiesJson,
          createdByTeacherId: null,
          claimStatus: "unclaimed",
          source: input.source,
          sourcePlaceId: externalKey,
          importedAt: new Date(),
        });
      }

      for (let i = 0; i < newRows.length; i += 500) {
        const chunk = newRows.slice(i, i + 500);
        if (chunk.length === 0) continue;
        await trx.insertInto("organizations").values(chunk).execute();
        imported += chunk.length;
      }
    });

    return new Response(
      superjson.stringify({
        totalReceived: input.rows.length,
        imported,
        updated,
        universitiesCreated,
        skipped: skippedRows.length,
        skippedRows,
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("Failed to bulk-upload organizations:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: "Failed to bulk-upload organisations.", details: errorMessage }),
      { status: 500 }
    );
  }
}
