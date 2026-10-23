import { defineScreens, httpError } from "@floot/examples";
import type { OutputType as ListOutput } from "../endpoints/glossary/list_GET.schema";

const loaded: ListOutput = {
  terms: [
    { term: "Achievement test", slug: "achievement-test", category: "test_types", definition: "Measures what a student has already learned." },
    { term: "Computer-based test", slug: "computer-based-test", category: "delivery_and_creation", definition: "An exam taken on a computer." },
    { term: "Criterion-referenced test", slug: "criterion-referenced-test", category: "scoring_and_assessment", definition: "Scores a student against a fixed standard." },
    { term: "Mock test", slug: "mock-test", category: "test_types", definition: "A practice exam taken under real conditions." },
    { term: "OMR sheet", slug: "omr-sheet", category: "delivery_and_creation", definition: "An answer sheet read by a machine." },
    { term: "Open book test", slug: "open-book-test", category: "test_types", definition: "An exam where notes may be used." },
    { term: "Oral test", slug: "oral-test", category: "test_types", definition: "An exam answered by speaking." },
    { term: "Percentile", slug: "percentile", category: "scoring_and_assessment", definition: "The share of test takers scoring at or below a given score." },
    { term: "Raw score", slug: "raw-score", category: "scoring_and_assessment", definition: "The marks earned before any scaling." },
    { term: "Time-bound test", slug: "time-bound-test", category: "delivery_and_creation", definition: "A paper that must be finished in a set time." },
    { term: "Weightage", slug: "weightage", category: "scoring_and_assessment", definition: "How much a topic counts towards the total marks." },
  ],
};

export default defineScreens({
  screens: [
    { title: "Loaded", backend: { "glossary/list_GET": loaded } },
    { title: "No terms yet", backend: { "glossary/list_GET": { terms: [] } } },
    { title: "Load failed", backend: { "glossary/list_GET": httpError(500) } },
  ],
});