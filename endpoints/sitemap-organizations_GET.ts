import { buildOrganizationSitemapIndexXml, ORG_SITEMAP_CACHE_HEADERS } from "../helpers/organizationSitemap";

/**
 * Sitemap INDEX for organisations - this is the single URL registered in
 * robots.txt. It fans out to the 5 type-specific sitemaps
 * (sitemap-organizations-school, -college, -coaching, -university, -other),
 * kept separate so each organisation type can be resubmitted/monitored on
 * its own in Search Console as its catalog grows independently.
 */
export async function handle(request: Request) {
  try {
    const xml = await buildOrganizationSitemapIndexXml();
    return new Response(xml, { headers: ORG_SITEMAP_CACHE_HEADERS, status: 200 });
  } catch (error) {
    console.error("Failed to generate organisation sitemap index:", error);
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(`Error generating sitemap index: ${message}`, {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    });
  }
}
