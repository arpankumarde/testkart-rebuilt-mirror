import type { PagePrefetchFn } from "@floot/prefetch";
import { prefetchExamContentSection } from "../helpers/prefetchExamContentSection";

export const prefetch: PagePrefetchFn = ({ qc, url }) => prefetchExamContentSection(qc, url);
