import type { PagePrefetchFn } from "@floot/prefetch";
import { fetchHomepageDataServer } from "../helpers/fetchHomepageDataServer";
import { fetchTeacherProfileServer } from "../helpers/fetchTeacherProfileServer";
import { fetchExamBySlugServer } from "../helpers/fetchExamBySlugServer";
import { fetchTestsListServer } from "../helpers/fetchTestsListServer";
import { fetchShopProductsListServer } from "../helpers/fetchShopProductsListServer";
import { fetchCourseDetailsServer } from "../helpers/fetchCourseDetailsServer";
import { loadPublicPromoCodes } from "../helpers/publicPromoCodesServer";
import {
  UGC_NET_EXAM_SLUG,
  UGC_NET_FEATURED_TEACHER_SLUG,
  pickFeaturedCourse,
  ugcNetNotesFilters,
  ugcNetTestsFilters,
} from "../helpers/ugcNetSpotlightQueries";

// Same query keys as HomepageUgcNetSpotlight, so the whole spotlight is in the served HTML.
const prefetchUgcNetSpotlight: PagePrefetchFn = async ({ qc }) => {
  const exam = await qc.fetchQuery({
    queryKey: ["exam-detail", UGC_NET_EXAM_SLUG],
    queryFn: () => fetchExamBySlugServer(UGC_NET_EXAM_SLUG),
  });
  if (!exam) return;

  const testsFilters = ugcNetTestsFilters(exam.id);
  const notesFilters = ugcNetNotesFilters(exam.id);
  await Promise.all([
    qc.prefetchQuery({
      queryKey: ["tests", "list", testsFilters],
      queryFn: () => fetchTestsListServer(testsFilters),
    }),
    qc.prefetchQuery({
      queryKey: ["shop", "products", notesFilters],
      queryFn: () => fetchShopProductsListServer(notesFilters),
    }),
  ]);
};

// The featured course, its details (lesson count, pricing) and its public
// coupons, under the course page's own keys so both pages share the cache.
const prefetchUgcNetFeaturedCourse: PagePrefetchFn = async ({ qc }) => {
  const profile = await qc.fetchQuery({
    queryKey: ["teacherProfile", UGC_NET_FEATURED_TEACHER_SLUG],
    queryFn: () => fetchTeacherProfileServer(UGC_NET_FEATURED_TEACHER_SLUG),
  });
  const featured = pickFeaturedCourse(profile.courses);
  if (!featured) return;
  await Promise.all([
    qc.prefetchQuery({
      queryKey: ["public", "courses", "details", featured.slug],
      queryFn: () => fetchCourseDetailsServer(featured.slug),
    }),
    qc.prefetchQuery({
      queryKey: ["public", "promo-codes", "course", featured.id],
      queryFn: async () => ({ promoCodes: await loadPublicPromoCodes("course", featured.id) }),
    }),
  ]);
};

export const prefetch: PagePrefetchFn = async (ctx) => {
  const { qc } = ctx;

  await Promise.all([
    qc
      .prefetchQuery({
        queryKey: ["homepage", "data"],
        queryFn: () => fetchHomepageDataServer(),
      })
      .catch((error) => console.error("Error prefetching homepage data:", error)),
    Promise.resolve(prefetchUgcNetFeaturedCourse(ctx)).catch((error) =>
      console.error("Error prefetching the UGC NET featured course:", error),
    ),
    Promise.resolve(prefetchUgcNetSpotlight(ctx)).catch((error) =>
      console.error("Error prefetching the UGC NET spotlight lists:", error),
    ),
  ]);

  return { maxAge: 300 }; // Cache for 5 minutes
};
