import type { PagePrefetchFn } from "@floot/prefetch";
import { getTeacherTrashList } from "../endpoints/teacher/trash/list_GET.schema";

export const prefetch: PagePrefetchFn = async (ctx) => {
  const { qc, getRequest } = ctx;
  const request = getRequest();
  
  // Try to load the initial list SSR-ready if the user session exists
  try {
    await qc.prefetchQuery({
      queryKey: ["teacher", "trash"],
      queryFn: () => getTeacherTrashList({
        headers: {
          cookie: request.headers.get("cookie") || "",
          authorization: request.headers.get("authorization") || "",
        }
      })
    });
  } catch (err) {
    // Fail silently in prefetch, client side will handle rendering errors via skeleton
  }
  
  return { maxAge: 0 }; // Cannot cache administrative endpoints
};