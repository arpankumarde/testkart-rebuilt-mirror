import type { PagePrefetchFn } from "@floot/prefetch";
import { fetchTeacherProfileServer, TeacherNotFoundError } from "../helpers/fetchTeacherProfileServer";

export const prefetch: PagePrefetchFn = async (ctx) => {
  const { qc, url } = ctx;
  const [, teacherSlug] = new URL(url).pathname.split("/").filter(Boolean);

  if (!teacherSlug) return { statusCode: 404, maxAge: 300 };

  try {
    // Must match the queryKey used by useTeacherPublicProfileQuery
    // (helpers/useTeacherPublicProfile.tsx) so the client hydrates from
    // this cache instead of showing the loading placeholder to crawlers
    // and social scrapers.
    await qc.fetchQuery({
      queryKey: ["teacherProfile", teacherSlug],
      queryFn: () => fetchTeacherProfileServer(teacherSlug),
    });
    return { maxAge: 300 };
  } catch (error) {
    if (error instanceof TeacherNotFoundError) return { statusCode: 404, maxAge: 300 };
    console.error("Error prefetching teacher profile:", error);
    // Not cached, so a transient database failure is not served to every visitor for five minutes.
    return { maxAge: 0 };
  }
};
