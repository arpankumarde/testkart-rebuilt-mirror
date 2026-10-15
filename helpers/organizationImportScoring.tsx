/**
 * Auto quality gate for bulk-importing scraped Google Maps listings as
 * "unclaimed" organisations. The goal is to make large-scale import work
 * WITHOUT a human reviewing every row: every listing gets scored by cheap,
 * deterministic signals, and only listings that fail outright are skipped.
 * Nothing here blocks on a person looking at the data.
 */

// Words that are category/filler words, not a business's actual name. A
// title made up ENTIRELY of these (e.g. "Tuition Centre", "Coaching Classes")
// is a placeholder pin with no identifiable business behind it.
const GENERIC_NAME_WORDS = new Set([
  "coaching", "center", "centre", "institute", "institution", "academy", "classes", "class",
  "tuition", "tution", "tutorial", "tutorials", "tutoring", "education", "educational",
  "learning", "study", "studies", "studying", "school", "college", "training", "the", "and",
  "for", "of", "in", "a", "an", "new", "best", "top", "pvt", "ltd", "llp", "private", "limited",
  "competitive", "competition", "point",
]);

/** True when a title carries no distinguishing name at all. */
export function isGenericListingName(title: string | null | undefined): boolean {
  if (!title) return true;
  const words = title.toLowerCase().match(/[a-z']+/g) ?? [];
  if (words.length === 0) return true; // e.g. non-Latin script we can't parse - treat cautiously
  const meaningful = words.filter((w) => !GENERIC_NAME_WORDS.has(w));
  return meaningful.length === 0;
}

export type ScrapedPlaceInput = {
  placeId: string;
  title: string | null;
  categoryName?: string | null;
  categories?: string[] | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  phone?: string | null;
  phoneUnformatted?: string | null;
  website?: string | null;
  emails?: string[] | null;
  totalScore?: number | null;
  reviewsCount?: number | null;
  permanentlyClosed?: boolean | null;
  temporarilyClosed?: boolean | null;
  searchString?: string | null;
};

export type ScrapedPlaceEvaluation =
  | { accept: true }
  | { accept: false; reason: string };

/**
 * The actual quality gate. Every rejection reason is specific so an admin can
 * see WHY a batch under-imported without re-reading every row by hand.
 */
export function evaluateScrapedPlace(place: ScrapedPlaceInput): ScrapedPlaceEvaluation {
  if (!place.placeId) {
    return { accept: false, reason: "missing_place_id" };
  }
  if (!place.title || place.title.trim().length === 0) {
    return { accept: false, reason: "missing_name" };
  }
  if (place.permanentlyClosed) {
    return { accept: false, reason: "permanently_closed" };
  }
  if (isGenericListingName(place.title)) {
    return { accept: false, reason: "generic_placeholder_name" };
  }
  const hasPhone = !!(place.phone || place.phoneUnformatted);
  const hasWebsite = !!place.website;
  const hasEmail = !!(place.emails && place.emails.length > 0);
  if (!hasPhone && !hasWebsite && !hasEmail) {
    // No contact info at all means nobody will ever be able to claim this
    // profile (our claim flow only verifies against the listing's own
    // scraped contact details), so it would sit unclaimed forever.
    return { accept: false, reason: "no_contact_info" };
  }
  return { accept: true };
}

export function buildLocationString(place: ScrapedPlaceInput): string | null {
  const parts = [place.city, place.state].filter((p): p is string => !!p && p.trim().length > 0);
  if (parts.length > 0) return parts.join(", ");
  return place.address ?? null;
}
