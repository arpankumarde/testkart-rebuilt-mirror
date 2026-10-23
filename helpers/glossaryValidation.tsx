import type { InputType, ValidationIssue } from "../endpoints/admin/glossary/save_POST.schema";
import { glossaryMeta } from "./glossaryMeta";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Exactly this many related terms before a term can go live. */
export const RELATED_TERM_COUNT = 3;

const isCanonicalUrl = (value: string) => {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && url.hostname === "testkart.in";
  } catch {
    return false;
  }
};

/**
 * Field-level checks keyed by the editor's form paths. A draft needs the term, its category and its
 * one-line definition; publishing also needs the explanation, the product link and three related
 * terms. Those related terms may still be drafts: public queries only ever return published ones,
 * so no link can break, and the first terms of a new glossary would otherwise never go live.
 */
export function validateGlossaryTerm(input: InputType): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const strict = input.status === "published";
  const add = (path: string, message: string) => issues.push({ path, message });

  if (!input.term.trim()) add("term", "Add the term name");
  if (!input.category) add("category", "Choose a category");
  if (!input.definition.trim()) add("definition", "Write the one-line definition");
  if (/[\r\n]/.test(input.definition.trim())) add("definition", "Keep the definition on one line");
  if (input.slug && !SLUG_PATTERN.test(input.slug)) add("slug", "Use lowercase letters, numbers and single hyphens");

  const productUrl = input.productUrl.trim();
  if (productUrl && !glossaryMeta.isInternalPath(productUrl)) {
    add("productUrl", "Use an internal path starting with /, for example /sell/mock-test");
  }

  const relatedIds = input.relatedTermIds;
  if (new Set(relatedIds).size !== relatedIds.length) add("relatedTermIds", "Each related term can only be chosen once");
  if (input.id && relatedIds.includes(input.id)) add("relatedTermIds", "A term cannot be related to itself");

  if (input.canonicalUrl.trim() && !isCanonicalUrl(input.canonicalUrl)) {
    add("canonicalUrl", "Use a full https://testkart.in link, or leave blank for the default");
  }

  if (strict) {
    if (!glossaryMeta.hasText(input.explanationFirst)) add("explanationFirst", "Write the first paragraph");
    if (!glossaryMeta.hasText(input.explanationSecond)) add("explanationSecond", "Write the second paragraph");
    if (glossaryMeta.hasText(input.extraBody) && !input.extraHeading.trim()) add("extraHeading", "Give the extra section a heading");
    if (input.extraHeading.trim() && !glossaryMeta.hasText(input.extraBody)) add("extraBody", "Write the extra section, or clear its heading");
    if (!input.productText.trim()) add("productText", "Add the sentence about the product");
    if (!productUrl) add("productUrl", "Choose the landing page this term links to");
    if (!input.productLabel.trim()) add("productLabel", "Add the link label");
    if (relatedIds.length !== RELATED_TERM_COUNT) add("relatedTermIds", `Choose exactly ${RELATED_TERM_COUNT} related terms`);
  }

  return issues;
}