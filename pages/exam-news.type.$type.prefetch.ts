import type { PagePrefetchFn } from "@floot/prefetch";
import { prefetchExamNewsListing } from "../helpers/examNewsPrefetch";

export const prefetch: PagePrefetchFn = (ctx) => prefetchExamNewsListing(ctx);