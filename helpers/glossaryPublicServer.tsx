import { sql } from "kysely";
import { db } from "./db";
import { glossaryMeta } from "./glossaryMeta";
import type { PublicGlossaryCard } from "../endpoints/glossary/list_GET.schema";
import type { OutputType as DetailOutput } from "../endpoints/glossary/details_GET.schema";

/** Every query here is limited to published terms, so a draft can never reach a public page or link. */
const publishedTerms = () => db.selectFrom("glossaryTerms as t").where("t.status", "=", "published");

async function fetchTerms(): Promise<PublicGlossaryCard[]> {
  return publishedTerms()
    .select(["t.term", "t.slug", "t.category", "t.definition"])
    .orderBy(sql`lower(t.term)`)
    .execute();
}

/** A term by its slug or an older one; null when it is missing or not published. */
async function fetchDetail(slug: string): Promise<DetailOutput | null> {
  const term = await publishedTerms()
    .select([
      "t.id",
      "t.term",
      "t.slug",
      "t.category",
      "t.definition",
      "t.explanationHeading",
      "t.explanationFirst",
      "t.explanationSecond",
      "t.extraHeading",
      "t.extraBody",
      "t.productText",
      "t.productUrl",
      "t.productLabel",
      "t.seoTitle",
      "t.seoDescription",
      "t.canonicalUrl",
    ])
    .where((eb) => eb.or([eb("t.slug", "=", slug), sql<boolean>`t.previous_slugs @> ARRAY[${slug}]::text[]`]))
    .executeTakeFirst();
  if (!term) return null;

  const related = await publishedTerms()
    .innerJoin("glossaryTermRelations as r", "r.relatedTermId", "t.id")
    .select(["t.term", "t.slug", "t.category", "t.definition"])
    .where("r.termId", "=", term.id)
    .orderBy("r.position")
    .execute();

  const { id: _id, ...content } = term;
  return { term: content, canonicalPath: glossaryMeta.termPath(term.slug), related };
}

/** The hub and each published term. The hub is left out until it has something on it. */
async function fetchSitemapEntries(): Promise<{ path: string; updatedAt: Date }[]> {
  const rows = await publishedTerms().select(["t.slug", "t.updatedAt"]).orderBy("t.updatedAt", "desc").execute();
  if (rows.length === 0) return [];
  return [
    { path: glossaryMeta.HUB_PATH, updatedAt: rows[0].updatedAt },
    ...rows.map((row) => ({ path: glossaryMeta.termPath(row.slug), updatedAt: row.updatedAt })),
  ];
}

export const glossaryPublicServer = { fetchTerms, fetchDetail, fetchSitemapEntries };