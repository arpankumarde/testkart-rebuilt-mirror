import type { PagePrefetchFn } from "@floot/prefetch";
import { prefetchCurrentAffairsListing } from "../helpers/currentAffairsPrefetch";

export const prefetch: PagePrefetchFn = (ctx) => prefetchCurrentAffairsListing(ctx, "daily");