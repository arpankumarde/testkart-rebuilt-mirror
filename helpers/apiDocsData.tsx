import { ApiEndpoint } from "./apiDocsTypes";
import { apiDocsAuth } from "./apiDocsAuth";
import { apiDocsTests } from "./apiDocsTests";
import { apiDocsContent } from "./apiDocsContent";
import { apiDocsCommerce } from "./apiDocsCommerce";
import { apiDocsSite } from "./apiDocsSite";
import { apiDocsMcp } from "./apiDocsMcp";

/*
 * Every non-console route under /_api: public, student and shared endpoints plus the MCP connectors.
 * Teacher console (/_api/teacher/*) and admin panel (/_api/admin/*) routes are left out on purpose.
 */
const CATEGORY_ORDER = [
  "Authentication",
  "Account",
  "Tests",
  "Test attempts",
  "Live tests",
  "Exams",
  "Courses",
  "Bundles",
  "Study notes",
  "Reviews",
  "Teachers",
  "Cart and orders",
  "Payments",
  "Promo codes",
  "Wallet and payouts",
  "Certificates",
  "Blog and news",
  "Careers",
  "Site",
  "Uploads",
  "Teacher payments",
  "Webhooks and jobs",
  "MCP connectors",
];

const categoryRank = (category: string) => {
  const index = CATEGORY_ORDER.indexOf(category);
  return index === -1 ? CATEGORY_ORDER.length : index;
};

export const apiDocsData: ApiEndpoint[] = [
  ...apiDocsAuth,
  ...apiDocsTests,
  ...apiDocsContent,
  ...apiDocsCommerce,
  ...apiDocsSite,
  ...apiDocsMcp,
].sort((a, b) => categoryRank(a.category) - categoryRank(b.category));

export const getApiCategories = () => {
  const categories = new Set(apiDocsData.map((endpoint) => endpoint.category));
  return ["All", ...Array.from(categories)];
};

export * from "./apiDocsTypes";
