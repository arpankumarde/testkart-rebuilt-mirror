import type { PagePrefetchFn } from "@floot/prefetch";
import { LIVE_TESTS_PATH } from "../helpers/liveTestRoutes";

export const prefetch: PagePrefetchFn = async () => ({ redirect: { to: LIVE_TESTS_PATH } });
