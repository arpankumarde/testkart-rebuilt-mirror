// Fuzzy-duplicate detection for the free-text "custom exam name" backlog.
//
// This is intentionally a *suggestion* layer, never an auto-merge: it groups
// names that are very likely the same exam (case/whitespace variants, or
// near-identical strings like "NEET" / "NEET UG" / "Neet") so an admin can
// review and merge them with one click, instead of noticing duplicates by
// eye across a list of hundreds. Nothing here writes to the database.

export interface CustomExamNameCount {
  name: string;
  mockTestCount: number;
  productCount: number;
  liveTestCount: number;
}

export interface DuplicateGroup {
  // Stable id for the group, derived from its members — used as a React key
  // and to detect when a group's membership has shifted after a merge.
  id: string;
  confidence: "exact" | "similar";
  members: CustomExamNameCount[];
  // Best guess at what the merged name should be — the member with the
  // most combined usage (ties broken by longer name, which tends to be the
  // fuller/more descriptive variant, e.g. "NEET UG" over "NEET").
  suggestedCanonicalName: string;
}

// Lowercase, trim, collapse whitespace, and drop punctuation that doesn't
// change the exam identity (periods, hyphens, apostrophes) — this alone
// catches "Railway" vs "Railway ", "NEET" vs "Neet", "U.P.S.C" vs "UPSC".
export function normalizeExamName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[.'’]/g, "")
    .replace(/[-_/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function totalUsage(item: CustomExamNameCount): number {
  return item.mockTestCount + item.productCount + item.liveTestCount;
}

// Small Levenshtein implementation — fine for exam-name-length strings
// (rarely more than 40 characters), no need for a dependency.
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const prev = new Array(n + 1);
  const curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}

// Word-boundary substring check — "neet ug" is "contained" in "neet ug
// (national eligibility cum entrance test)", so a short/full-name pair like
// that should merge. But this check alone is dangerous for single generic
// words: "cbse" or "ssc" are word-subsets of dozens of unrelated multi-topic
// names ("CBSE Class 12 Boards, NEET", "SSC CGL, SSC CHSL, STATE PSC,
// RAILWAY"...), and left unbounded those short words become "hubs" that
// transitively chain hundreds of unrelated exams into one group. The length
// and word-count bounds below keep this to genuine abbreviation/full-name
// pairs (JEE -> JEE Main, NEET UG -> NEET UG (full form)) without letting a
// 4-character word swallow the entire list.
function isWordSubset(shorter: string, longer: string): boolean {
  const shortWords = shorter.split(" ").filter(Boolean);
  const longWords = longer.split(" ").filter(Boolean);
  const longWordSet = new Set(longWords);
  if (shortWords.length === 0 || !shortWords.every((w) => longWordSet.has(w))) return false;
  // The longer name can't run away from the shorter one — at most 3 extra
  // words and at most ~2.5x the character length.
  if (longWords.length - shortWords.length > 3) return false;
  if (longer.length > shorter.length * 2.5 + 10) return false;
  return true;
}

function isSimilar(normA: string, normB: string): boolean {
  if (normA === normB) return true;
  // Very short strings (single short words like "SSC", "JEE") are the main
  // source of accidental hub-merging — only let them participate in fuzzy
  // matching via the tightly-bounded word-subset check below, never via
  // edit distance, and never as the "longer" side of a subset check.
  if (normA.length < 3 || normB.length < 3) return false;
  const shorter = normA.length <= normB.length ? normA : normB;
  const longer = normA.length <= normB.length ? normB : normA;
  if (isWordSubset(shorter, longer)) return true;
  // Only compare edit distance for strings close enough in length that a
  // small distance is meaningful, and long enough that a distance of 2
  // isn't most of the string (avoids "SSC" ~ "SBI" style false positives).
  if (Math.abs(normA.length - normB.length) <= 3 && Math.min(normA.length, normB.length) >= 6) {
    return levenshtein(normA, normB) <= 2;
  }
  return false;
}

// A legitimate exam-name duplicate cluster is a handful of spelling/wording
// variants — not dozens. If bounded pairwise matching still produces a huge
// connected component (almost always generic short words chaining unrelated
// multi-topic names together), it's noise, not a usable suggestion: better
// to show nothing for that cluster than to hand an admin a "merge these 250
// names" button.
const MAX_GROUP_SIZE = 8;

export function findDuplicateGroups(names: CustomExamNameCount[]): DuplicateGroup[] {
  const n = names.length;
  const normalized = names.map((item) => normalizeExamName(item.name));

  // Union-find over indices so transitively-similar names (A~B, B~C) end up
  // in one group even if A and C aren't directly similar to each other.
  const parent = Array.from({ length: n }, (_, i) => i);
  function find(x: number): number {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  }
  function union(a: number, b: number) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  }

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (normalized[i] === normalized[j] || isSimilar(normalized[i], normalized[j])) {
        union(i, j);
      }
    }
  }

  const groupsByRoot = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    const list = groupsByRoot.get(root) ?? [];
    list.push(i);
    groupsByRoot.set(root, list);
  }

  const groups: DuplicateGroup[] = [];
  for (const indices of groupsByRoot.values()) {
    if (indices.length < 2 || indices.length > MAX_GROUP_SIZE) continue;
    const members = indices.map((i) => names[i]);
    // A group is "exact" confidence only if every pair in it normalized to
    // the same string — otherwise at least one pair was a fuzzy match, so
    // the whole group is presented as "similar" (needs a closer look).
    const allExact = indices.every((i, idx) =>
      indices.slice(idx + 1).every((j) => normalized[i] === normalized[j])
    );
    const sorted = [...members].sort(
      (a, b) => totalUsage(b) - totalUsage(a) || b.name.length - a.name.length
    );
    groups.push({
      id: indices.map((i) => names[i].name).sort().join("|"),
      confidence: allExact ? "exact" : "similar",
      members: sorted,
      suggestedCanonicalName: sorted[0].name,
    });
  }

  // Highest-usage, highest-confidence groups first — that's where cleanup
  // effort pays off fastest.
  return groups.sort((a, b) => {
    if (a.confidence !== b.confidence) return a.confidence === "exact" ? -1 : 1;
    const usageA = a.members.reduce((sum, m) => sum + totalUsage(m), 0);
    const usageB = b.members.reduce((sum, m) => sum + totalUsage(m), 0);
    return usageB - usageA;
  });
}
