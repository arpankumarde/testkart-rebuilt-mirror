/** Public live test routes. The slug is the one stored on the live test's mock test package. */
export const LIVE_TESTS_PATH = "/live-test";

export const liveTestPath = (slug: string): string => `${LIVE_TESTS_PATH}/${encodeURIComponent(slug)}`;
