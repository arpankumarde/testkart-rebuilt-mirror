import { ApiEndpoint } from "./apiDocsTypes";
import { apiDocsAuth } from "./apiDocsAuth";
import { apiDocsTests } from "./apiDocsTests";
import { apiDocsCommerce } from "./apiDocsCommerce";
import { apiDocsUserMisc } from "./apiDocsUserMisc";

export const apiDocsData: ApiEndpoint[] = [
  ...apiDocsAuth,
  ...apiDocsTests,
  ...apiDocsCommerce,
  ...apiDocsUserMisc,
];

export const getApiCategories = () => {
  const categories = new Set(apiDocsData.map(endpoint => endpoint.category));
  return ["All", ...Array.from(categories)];
};

export * from "./apiDocsTypes";