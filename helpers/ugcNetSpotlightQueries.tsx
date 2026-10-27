import { swmgPromoContent } from "./swmgPromoContent";
import type { CourseListItem } from "../endpoints/courses/list_GET.schema";

/**
 * Shared by components/HomepageUgcNetSpotlight and pages/_index.prefetch.ts so
 * the SSR pass and the client use identical query keys. The list filters
 * match the ones on /exams/:examSlug/mock-tests and /study-notes, so those
 * pages open from the same cache.
 */
export const UGC_NET_EXAM_SLUG = "ugc-net";

/** The featured course comes from this teacher's published courses. */
export const UGC_NET_FEATURED_TEACHER_SLUG = swmgPromoContent.teacherSlug;

/**
 * The featured course: the teacher's most enrolled course, keeping profile
 * order on ties. Its details (lesson count, pricing) are read with the course
 * page's own query key, ["public", "courses", "details", slug].
 */
export function pickFeaturedCourse(courses: CourseListItem[] | undefined): CourseListItem | null {
  if (!courses || courses.length === 0) return null;
  const enrolled = (c: CourseListItem) => Number(c.enrollmentCount) || 0;
  return courses.reduce((best, course) => (enrolled(course) > enrolled(best) ? course : best));
}

const LIST_LIMIT = 12;

export const ugcNetTestsFilters = (examId: number) => ({
  examId: String(examId),
  sortBy: "popular" as const,
  page: "1",
  limit: String(LIST_LIMIT),
});

export const ugcNetNotesFilters = (examId: number) => ({
  examId,
  page: 1,
  limit: LIST_LIMIT,
  sort: "popular" as const,
});

export const ugcNetPaths = {
  hub: `/exams/${UGC_NET_EXAM_SLUG}`,
  mockTests: `/exams/${UGC_NET_EXAM_SLUG}/mock-tests`,
  notes: `/exams/${UGC_NET_EXAM_SLUG}/study-notes`,
};

/**
 * Reorders a popularity-sorted list so consecutive cards come from different
 * teachers where possible: one item per teacher per round, keeping each
 * teacher's own order.
 */
export function interleaveByTeacher<T>(items: T[], teacherKey: (item: T) => string): T[] {
  const queues = new Map<string, T[]>();
  for (const item of items) {
    const key = teacherKey(item);
    const queue = queues.get(key);
    if (queue) queue.push(item);
    else queues.set(key, [item]);
  }
  const result: T[] = [];
  const lists = [...queues.values()];
  for (let round = 0; result.length < items.length; round++) {
    for (const list of lists) {
      if (round < list.length) result.push(list[round]);
    }
  }
  return result;
}
