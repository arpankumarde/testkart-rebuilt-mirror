import { ApiEndpoint } from "./apiDocsTypes";

export const apiDocsExamsList: ApiEndpoint[] = [
  {
    method: "GET",
    route: "/_api/exams/list",
    description: "Get a list of all available exams, optionally grouped by category",
    auth: "none",
    category: "Exams",
    queryParams: [
      { name: "categoryId", type: "number", required: false, description: "Filter by exam category ID" },
      { name: "search", type: "string", required: false, description: "Search by exam name" },
    ],
    responseFields: [
      { name: "exams", type: "array", description: "Array of exam objects with slug and category info" },
      { name: "categories", type: "array", description: "Array of all exam category objects" },
    ],
  },
  {
    method: "GET",
    route: "/_api/exams/popular-with-tests",
    description: "Get popular exams that have published mock tests available",
    auth: "none",
    category: "Exams",
    queryParams: [
      { name: "limit", type: "number", required: false, description: "Number of exams to return (default: 10)" },
    ],
    responseFields: [
      { name: "exams", type: "array", description: "Array of popular exam objects with associated test count" },
    ],
  },
];