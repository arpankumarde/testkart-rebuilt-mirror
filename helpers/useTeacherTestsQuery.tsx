import { useQuery, UseQueryOptions } from "@tanstack/react-query";
import { getTeacherTestsList } from "../endpoints/teacher/tests/list_GET.schema";
import { getTeacherQuestionsList } from "../endpoints/teacher/questions/list_GET.schema";
import { getTeacherTestItemsList } from "../endpoints/teacher/test-items/list_GET.schema";

export const TEACHER_TESTS_QUERY_KEY = ["teacher", "tests"];
export const TEACHER_QUESTIONS_QUERY_KEY_PREFIX = "teacher-questions";
export const TEACHER_TEST_ITEMS_QUERY_KEY_PREFIX = "teacher-test-items";

// `options` lets a specific caller opt into stricter freshness (e.g. the
// review/publish page, which needs to see a test package the instant it's
// created rather than trusting a 15-minute-stale cache) without changing
// the default, cache-friendly behavior every other caller relies on.
export const useTeacherTestsQuery = (
  options?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getTeacherTestsList>>>>
) => {
  return useQuery({
    queryKey: TEACHER_TESTS_QUERY_KEY,
    queryFn: () => getTeacherTestsList({}),
    staleTime: 15 * 60 * 1000,
    // See the matching comment in useTeacherProductsQuery — refetchOnMount
    // is disabled globally, which also blocks the normal "refetch if
    // invalidated" check on remount. This list gets invalidated by test
    // mutations from other pages, so without this override it'd show stale
    // data until a hard reload.
    refetchOnMount: true,
    ...options,
  });
};

export const useTeacherQuestionsQuery = (testItemId: number | null) => {
  return useQuery({
    queryKey: [TEACHER_QUESTIONS_QUERY_KEY_PREFIX, testItemId],
    queryFn: () => getTeacherQuestionsList({ testItemId: testItemId! }),
    enabled: testItemId !== null,
  });
};

export const useTeacherTestItemsQuery = (
  packageId: number | null,
  options?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getTeacherTestItemsList>>>>
) => {
  return useQuery({
    queryKey: [TEACHER_TEST_ITEMS_QUERY_KEY_PREFIX, packageId],
    queryFn: () => getTeacherTestItemsList({ packageId: packageId! }),
    enabled: packageId !== null,
    // questionsCount/missingAnswerCount on each item are mutated from the
    // questions page and read back here — see the matching note in
    // useTestItemSubjectsQuery for why the global refetchOnMount:false makes
    // that go stale on navigation.
    refetchOnMount: true,
    ...options,
  });
};