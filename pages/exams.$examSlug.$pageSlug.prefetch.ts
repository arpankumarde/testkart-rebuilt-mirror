import type { PagePrefetchFn } from "@floot/prefetch";
import { prefetchExamContentSection } from "../helpers/prefetchExamContentSection";

// Admin-added custom pages; an unknown or unpublished slug redirects to the hub.
export const prefetch: PagePrefetchFn = ({ qc, url }) => prefetchExamContentSection(qc, url);
