import { db } from "./db";
import { getOrganizationProfilePath } from "./organizationRoutes";
import { OrganizationTypeValues, type OrganizationTypeValue } from "../endpoints/teacher/organizations/create_POST.schema";

export const BASE_URL = "https://testkart.in";

/**
 * One dedicated sitemap per organisation type, mirroring the type-prefixed
 * public routes (/school, /college, /coaching, /university, /organisation
 * for "other"). Kept separate from the main sitemap.xml and from each other
 * so each type can be resubmitted/monitored independently in Search Console
 * and so no single file grows unbounded as one type's catalog scales -
 * "coaching" already dwarfs the others.
 */
export const ORG_SITEMAP_ROUTE_SEGMENT: Record<OrganizationTypeValue, string> = {
  coaching: "coaching",
  school: "school",
  college: "college",
  university: "university",
  other: "other",
};

function toW3CDate(date: Date | string | null | undefined): string | undefined {
  if (!date) return undefined;
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return undefined;
  return d.toISOString().split("T")[0];
}

function generateUrlEntry(loc: string, lastmod: string | undefined, changefreq: string, priority: number): string {
  const lastmodTag = lastmod ? `<lastmod>${lastmod}</lastmod>` : "";
  return `
  <url>
    <loc>${loc}</loc>${lastmodTag}
    <changefreq>${changefreq}</changefreq>
    <priority>${priority.toFixed(1)}</priority>
  </url>`;
}

/**
 * Builds the XML sitemap body for a single organisation type. Only
 * currently-active organisations are included - this is the exact same
 * gate `endpoints/organizations/profile_GET.ts` uses to decide whether the
 * page itself resolves (404 otherwise), so the sitemap never advertises a
 * URL that 404s. Unclaimed (auto-imported) listings are included on purpose:
 * they are real, live, indexable pages - keeping them out of the sitemap
 * would only slow down how fast organic search can surface them to the
 * teacher/owner who might claim them.
 */
export async function buildOrganizationTypeSitemapXml(orgType: OrganizationTypeValue): Promise<string> {
  const orgs = await db
    .selectFrom("organizations")
    .select(["slug", "orgType", "updatedAt"])
    .where("orgType", "=", orgType)
    .where("isActive", "=", true)
    .execute();

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

  for (const org of orgs) {
    const path = getOrganizationProfilePath(org.orgType as OrganizationTypeValue, org.slug);
    xml += generateUrlEntry(`${BASE_URL}${path}`, toW3CDate(org.updatedAt), "weekly", 0.6);
  }

  xml += `
</urlset>`;

  return xml.trim();
}

/**
 * Builds the sitemap INDEX that points at the 5 per-type organisation
 * sitemaps above. This is the one URL registered in robots.txt; crawlers
 * follow it out to each type-specific file themselves.
 */
export async function buildOrganizationSitemapIndexXml(): Promise<string> {
  const rows = await db
    .selectFrom("organizations")
    .select(["orgType"])
    .select((eb) => eb.fn.max("updatedAt").as("latestUpdatedAt"))
    .where("isActive", "=", true)
    .groupBy("orgType")
    .execute();

  const latestByType = new Map<string, Date | string | null>();
  for (const row of rows) {
    latestByType.set(row.orgType, row.latestUpdatedAt as Date | string | null);
  }

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

  for (const orgType of OrganizationTypeValues) {
    const lastmod = toW3CDate(latestByType.get(orgType) ?? null);
    const lastmodTag = lastmod ? `<lastmod>${lastmod}</lastmod>` : "";
    xml += `
  <sitemap>
    <loc>${BASE_URL}/_api/sitemap-organizations-${ORG_SITEMAP_ROUTE_SEGMENT[orgType]}</loc>${lastmodTag}
  </sitemap>`;
  }

  xml += `
</sitemapindex>`;

  return xml.trim();
}

export const ORG_SITEMAP_CACHE_HEADERS = {
  "Content-Type": "application/xml; charset=utf-8",
  "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
};
