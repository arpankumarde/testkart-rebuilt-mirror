import type { PagePrefetchFn } from "@floot/prefetch";
import { prefetchGlossaryTerm } from "../helpers/glossaryPrefetch";

export const prefetch: PagePrefetchFn = (ctx) => prefetchGlossaryTerm(ctx);