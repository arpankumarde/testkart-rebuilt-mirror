import type { PagePrefetchFn } from "@floot/prefetch";
import { fetchNewsDetailServer } from "../helpers/fetchNewsDetailServer";

export const prefetch: PagePrefetchFn = async (ctx) => {
  const { qc } = ctx;
  const slug = (ctx as any).params?.newsSlug;

  if (!slug) return { statusCode: 404 };

  try {
    const data = await qc.fetchQuery({
      queryKey: ["news", "details", slug],
      queryFn: () => fetchNewsDetailServer(slug),
    });

    // The slug was renamed and this request came in on a retired one - send
    // crawlers and readers to the canonical URL instead of serving the same
    // article under two addresses.
    if (data.item.slug !== slug) {
      return { redirect: { to: `/news-and-events/${data.item.slug}` } };
    }

    return { maxAge: 300 };
  } catch (error) {
    return { statusCode: 404 };
  }
};
