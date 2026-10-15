import { formatLanguages, itemLanguages, languagesSummary, normalizeLanguages } from "./itemLanguages";

describe("item languages", () => {
  it("trims, drops blanks and removes case-insensitive duplicates in order", () => {
    expect(normalizeLanguages([" Hindi ", "", "English", "hindi"])).toEqual(["Hindi", "English"]);
    expect(normalizeLanguages(null)).toEqual([]);
  });

  it("summarises a list for the legacy column, or null when empty", () => {
    expect(languagesSummary(["English", "Hindi"])).toBe("English, Hindi");
    expect(languagesSummary([" "])).toBeNull();
  });

  it("prefers the list and falls back to the legacy text", () => {
    expect(itemLanguages({ languages: ["Tamil", "English"], language: "Tamil, English" })).toEqual(["Tamil", "English"]);
    expect(itemLanguages({ languages: [], language: " Bilingual " })).toEqual(["Bilingual"]);
    expect(itemLanguages({ language: null })).toEqual([]);
    expect(formatLanguages({ languages: ["English", "Hindi"] })).toBe("English, Hindi");
  });
});
