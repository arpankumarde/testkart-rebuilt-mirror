import type { PagePrefetchFn } from "@floot/prefetch";
import { prefetchExamNewsStory } from "../helpers/examNewsPrefetch";

export const prefetch: PagePrefetchFn = (ctx) => prefetchExamNewsStory(ctx);