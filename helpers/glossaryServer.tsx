import superjson from "superjson";
import { sql, type Transaction } from "kysely";
import { db } from "./db";
import { ForbiddenError, NotAuthenticatedError } from "./getAdminSession";
import { sanitizeHtml } from "./sanitizeHtml";
import { slugify } from "./slugify";
import type { DB } from "./schema";
import type { InputType, ValidationIssue } from "../endpoints/admin/glossary/save_POST.schema";
import type { GlossaryTermDetail } from "../endpoints/admin/glossary/get_GET.schema";
import type { OutputType as ListOutput, ParsedInput as ListInput } from "../endpoints/admin/glossary/list_GET.schema";

/** Raised for content problems the editor can show against a field; endpoints answer 422. */
export class GlossaryInputError extends Error {
  issues: ValidationIssue[];
  constructor(message: string, issues: ValidationIssue[]) {
    super(message);
    this.name = "GlossaryInputError";
    this.issues = issues;
  }
}

type Trx = Transaction<DB>;

async function findSlugOwner(
  executor: Trx | typeof db,
  slug: string,
  excludeId?: number
): Promise<{ id: number; term: string } | undefined> {
  let query = executor
    .selectFrom("glossaryTerms")
    .select(["id", "term"])
    .where((eb) => eb.or([eb("slug", "=", slug), sql<boolean>`previous_slugs @> ARRAY[${slug}]::text[]`]));
  if (excludeId) query = query.where("id", "!=", excludeId);
  return query.executeTakeFirst();
}

const orNull = (value: string) => value.trim() || null;

const richOrNull = (value: string) => orNull(sanitizeHtml(value));

const isSlugConflict = (error: unknown) => {
  const { code, constraint_name: constraint } = error as { code?: string; constraint_name?: string };
  return code === "23505" && !!constraint?.includes("slug");
};

/** Writes the whole term. Related terms are replaced, not diffed. */
async function save(input: InputType, adminId: number): Promise<number> {
  const now = new Date();

  try {
    return await db.transaction().execute(async (trx) => {
      const existing = input.id
        ? await trx
            .selectFrom("glossaryTerms")
            .select(["id", "status", "slug", "previousSlugs", "publishedAt", "firstPublishedAt"])
            .where("id", "=", input.id)
            .forUpdate()
            .executeTakeFirst()
        : undefined;
      if (input.id && !existing) throw new Error("Glossary term not found");

      const issues: ValidationIssue[] = [];
      const slug = slugify(input.slug || input.term);
      if (!slug) issues.push({ path: "slug", message: "Add a slug" });
      else {
        const owner = await findSlugOwner(trx, slug, existing?.id);
        if (owner) issues.push({ path: "slug", message: `Already used by "${owner.term}"` });
      }
      if (input.relatedTermIds.length > 0) {
        const found = await trx.selectFrom("glossaryTerms").select("id").where("id", "in", input.relatedTermIds).execute();
        if (found.length !== new Set(input.relatedTermIds).size) {
          issues.push({ path: "relatedTermIds", message: "A related term no longer exists. Remove it and choose another." });
        }
      }
      if (issues.length > 0) throw new GlossaryInputError("Some fields need attention", issues);

      const previousSlugs =
        existing && existing.slug !== slug && existing.firstPublishedAt
          ? Array.from(new Set([...existing.previousSlugs, existing.slug])).filter((s) => s !== slug)
          : existing?.previousSlugs.filter((s) => s !== slug) ?? [];

      const publishing = input.status === "published";
      const publishedAt = publishing ? (existing?.status === "published" && existing.publishedAt) || now : null;

      const values = {
        term: input.term.trim(),
        slug,
        previousSlugs,
        category: input.category!,
        definition: input.definition.trim(),
        explanationHeading: orNull(input.explanationHeading),
        explanationFirst: sanitizeHtml(input.explanationFirst),
        explanationSecond: sanitizeHtml(input.explanationSecond),
        extraHeading: orNull(input.extraHeading),
        extraBody: richOrNull(input.extraBody),
        productText: orNull(input.productText),
        productUrl: orNull(input.productUrl),
        productLabel: orNull(input.productLabel),
        seoTitle: orNull(input.seoTitle),
        seoDescription: orNull(input.seoDescription),
        canonicalUrl: orNull(input.canonicalUrl),
        status: input.status,
        publishedAt,
        firstPublishedAt: existing?.firstPublishedAt ?? publishedAt,
        updatedBy: adminId,
        updatedAt: now,
      };

      let termId: number;
      if (existing) {
        termId = existing.id;
        await trx.updateTable("glossaryTerms").set(values).where("id", "=", termId).execute();
        await trx.deleteFrom("glossaryTermRelations").where("termId", "=", termId).execute();
      } else {
        const created = await trx
          .insertInto("glossaryTerms")
          .values({ ...values, createdBy: adminId })
          .returning("id")
          .executeTakeFirstOrThrow();
        termId = created.id;
      }

      if (input.relatedTermIds.length > 0) {
        await trx
          .insertInto("glossaryTermRelations")
          .values(input.relatedTermIds.map((relatedTermId, index) => ({ termId, relatedTermId, position: index + 1 })))
          .execute();
      }

      return termId;
    });
  } catch (error) {
    // Two saves can pass the owner check together; the unique index stops the second one.
    if (isSlugConflict(error)) {
      throw new GlossaryInputError("Some fields need attention", [{ path: "slug", message: "That slug was just taken" }]);
    }
    throw error;
  }
}

async function loadDetail(id: number): Promise<GlossaryTermDetail | null> {
  const row = await db
    .selectFrom("glossaryTerms as t")
    .leftJoin("admins as creator", "creator.id", "t.createdBy")
    .leftJoin("admins as editor", "editor.id", "t.updatedBy")
    .selectAll("t")
    .select(["creator.fullName as createdByName", "editor.fullName as updatedByName"])
    .where("t.id", "=", id)
    .executeTakeFirst();
  if (!row) return null;

  const [relatedTerms, usage] = await Promise.all([
    db
      .selectFrom("glossaryTermRelations as r")
      .innerJoin("glossaryTerms as t", "t.id", "r.relatedTermId")
      .select(["t.id", "t.term", "t.slug", "t.category", "t.definition", "t.status"])
      .where("r.termId", "=", id)
      .orderBy("r.position")
      .execute(),
    db
      .selectFrom("glossaryTermRelations")
      .select((eb) => eb.fn.countAll<string>().as("count"))
      .where("relatedTermId", "=", id)
      .executeTakeFirstOrThrow(),
  ]);

  return {
    id: row.id,
    term: row.term,
    slug: row.slug,
    category: row.category,
    definition: row.definition,
    explanationHeading: row.explanationHeading ?? "",
    explanationFirst: row.explanationFirst,
    explanationSecond: row.explanationSecond,
    extraHeading: row.extraHeading ?? "",
    extraBody: row.extraBody ?? "",
    productText: row.productText ?? "",
    productUrl: row.productUrl ?? "",
    productLabel: row.productLabel ?? "",
    relatedTermIds: relatedTerms.map((related) => related.id),
    seoTitle: row.seoTitle ?? "",
    seoDescription: row.seoDescription ?? "",
    canonicalUrl: row.canonicalUrl ?? "",
    status: row.status,
    relatedTerms,
    usedByCount: Number(usage.count),
    previousSlugs: row.previousSlugs,
    publishedAt: row.publishedAt,
    firstPublishedAt: row.firstPublishedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdByName: row.createdByName,
    updatedByName: row.updatedByName,
  };
}

/** One page of the admin table, plus the dashboard figures across the whole glossary. */
async function list(input: ListInput): Promise<ListOutput> {
  let base = db.selectFrom("glossaryTerms as t");
  if (input.search) {
    const term = `%${input.search.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    base = base.where("t.term", "ilike", term);
  }
  if (input.category) base = base.where("t.category", "=", input.category);
  if (input.status) base = base.where("t.status", "=", input.status);

  const [counted, rows, stats] = await Promise.all([
    base.select((eb) => eb.fn.countAll<string>().as("count")).executeTakeFirstOrThrow(),
    base
      .select([
        "t.id",
        "t.term",
        "t.slug",
        "t.category",
        "t.definition",
        "t.status",
        "t.updatedAt",
        sql<number>`(
          select count(*)::int from glossary_term_relations r
          join glossary_terms related on related.id = r.related_term_id
          where r.term_id = t.id and related.status = 'published'
        )`.as("liveRelatedCount"),
        sql<number>`(select count(*)::int from glossary_term_relations r where r.related_term_id = t.id)`.as("usedByCount"),
      ])
      .orderBy(input.sort === "alphabetical" ? sql`lower(t.term)` : sql`t.updated_at desc`)
      .orderBy("t.id", "desc")
      .limit(input.limit)
      .offset((input.page - 1) * input.limit)
      .execute(),
    db
      .selectFrom("glossaryTerms")
      .select([
        sql<number>`count(*)::int`.as("total"),
        sql<number>`(count(*) filter (where status = 'published'))::int`.as("published"),
        sql<number>`(count(*) filter (where status = 'draft'))::int`.as("draft"),
        sql<number>`(count(*) filter (where updated_at >= now() - interval '7 days'))::int`.as("recentlyUpdated"),
      ])
      .executeTakeFirstOrThrow(),
  ]);

  const total = Number(counted.count);
  return { rows, total, totalPages: Math.max(1, Math.ceil(total / input.limit)), stats };
}

/** The JSON error every admin glossary endpoint answers with. */
function errorResponse(error: unknown, context: string): Response {
  if (error instanceof GlossaryInputError) {
    return new Response(superjson.stringify({ error: error.message, issues: error.issues }), { status: 422 });
  }
  const status = error instanceof NotAuthenticatedError ? 401 : error instanceof ForbiddenError ? 403 : 400;
  if (status === 400) console.error(`${context}:`, error);
  return new Response(
    superjson.stringify({ error: error instanceof Error ? error.message : "Internal Server Error" }),
    { status }
  );
}

export const glossaryServer = { list, save, loadDetail, findSlugOwner, errorResponse };