import type { PagePrefetchFn } from "@floot/prefetch";
import { getCareerDetails } from "../endpoints/careers/details_GET.schema";

export const prefetch: PagePrefetchFn = async (ctx) => {
  const { qc } = ctx;
  const slug = (ctx as any).params?.careerSlug;

  if (!slug) return { statusCode: 404 };

  try {
    const data = await qc.fetchQuery({
      queryKey: ["careers", "details", slug],
      queryFn: () => getCareerDetails({ slug }),
    });

    if ("error" in data) {
      return { statusCode: 404 };
    }

    return { maxAge: 300 }; // Cache for 5 minutes
  } catch (error) {
    return { statusCode: 404 };
  }
};