import type { PagePrefetchFn } from "@floot/prefetch";
import { prefetchGovtExamsCalendar } from "../helpers/gecPrefetch";

export const prefetch: PagePrefetchFn = (ctx) => prefetchGovtExamsCalendar(ctx);