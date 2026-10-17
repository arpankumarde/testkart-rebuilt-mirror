import { buildOrganizationTypeSitemapXml, ORG_SITEMAP_CACHE_HEADERS } from "../helpers/organizationSitemap";

export async function handle(request: Request) {
  try {
    const xml = await buildOrganizationTypeSitemapXml("college");
    return new Response(xml, { headers: ORG_SITEMAP_CACHE_HEADERS, status: 200 });
  } catch (error) {
    console.error("Failed to generate college organisation sitemap:", error);
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(`Error generating sitemap: ${message}`, {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    });
  }
}
