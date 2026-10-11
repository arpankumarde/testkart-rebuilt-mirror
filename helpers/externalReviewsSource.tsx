import { REVIEWS_SOURCE, type OutputType } from "../endpoints/reviews/external_GET.schema";

/*
 * Server-side source of the external reviews shown on /about.
 *
 * The AmbitionBox overview page is not fetched. Its server answers automated
 * requests with 403 and its robots.txt disallows crawlers, so no rating, count
 * or review text is read from it.
 *
 * The category scores below come from the "ratings-detailed" badge that
 * AmbitionBox issues to Testkart as an employer
 * (https://employer.ambitionbox.com/api/badge/2108566?badge-type=ratings-detailed),
 * read by eye on 2026-10-16. The badge is a picture titled "Top 4 Category
 * Ratings" and states neither an overall rating nor a review count, so summary
 * stays null. Update CATEGORIES and AS_OF together when the badge changes.
 *
 * To turn on the rest of the section, fill in an approved source and keep the
 * return shape:
 *   - summary: the overall rating and review count exactly as AmbitionBox
 *     states them, and
 *   - reviews: a data feed AmbitionBox has licensed to Testkart (key kept in a
 *     secret and read from process.env), or excerpts that AmbitionBox or each
 *     reviewer has cleared for reuse, kept with their source link.
 * Only return what the source publishes. Never fill gaps - a null summary and an
 * empty reviews array simply leave those blocks off the page.
 */
const AS_OF = "2026-10-16";

const CATEGORIES: OutputType["categories"] = [
  { label: "Work Satisfaction", value: 4.3 },
  { label: "Company Culture", value: 4.3 },
  { label: "Work-Life Balance", value: 4.2 },
  { label: "Skill Development", value: 4.2 },
];

export async function loadExternalReviews(): Promise<OutputType> {
  return {
    source: REVIEWS_SOURCE,
    summary: null,
    categories: CATEGORIES,
    asOf: AS_OF,
    reviews: [],
  };
}
