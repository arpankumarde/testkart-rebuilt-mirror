import { ApiEndpoint } from "./apiDocsTypes";
import { apiDocsTestsList } from "./apiDocsTestsList";
import { apiDocsTestItemsList } from "./apiDocsTestItemsList";
import { apiDocsCoursesList } from "./apiDocsCoursesList";
import { apiDocsLiveTestsList } from "./apiDocsLiveTestsList";
import { apiDocsBundlesList } from "./apiDocsBundlesList";
import { apiDocsExamsList } from "./apiDocsExamsList";

export const apiDocsTests: ApiEndpoint[] = [
  ...apiDocsTestsList,
  ...apiDocsTestItemsList,
  ...apiDocsCoursesList,
  ...apiDocsLiveTestsList,
  ...apiDocsBundlesList,
  ...apiDocsExamsList,
];