import type { PagePrefetchFn } from "@floot/prefetch";
import { prefetchGlossaryHub } from "../helpers/glossaryPrefetch";

export const prefetch: PagePrefetchFn = (ctx) => prefetchGlossaryHub(ctx);