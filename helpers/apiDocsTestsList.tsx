import { ApiEndpoint } from "./apiDocsTypes";

export const apiDocsTestsList: ApiEndpoint[] = [
  {
    method: "GET",
    route: "/_api/tests/list",
    description: "List published mock test packages with optional filtering and sorting",
    auth: "none",
    category: "Tests",
    queryParams: [
      { name: "search", type: "string", required: false, description: "Search across title, description, subject, creator name, and exam name" },
      { name: "examId", type: "number", required: false, description: "Filter by exam ID" },
      { name: "language", type: "string", required: false, description: "Comma-separated list of languages to filter by" },
      { name: "priceType", type: "string", required: false, description: "'free', 'paid', or 'all'" },
      { name: "minPrice", type: "number", required: false, description: "Minimum price (used with priceType=paid)" },
      { name: "maxPrice", type: "number", required: false, description: "Maximum price (used with priceType=paid)" },
      { name: "sortBy", type: "string", required: false, description: "'newest', 'price_asc', 'price_desc', 'popular', or 'rating'" },
      { name: "page", type: "number", required: false, description: "Page number (default: 1)" },
      { name: "limit", type: "number", required: false, description: "Items per page (default: 20)" },
    ],
    responseFields: [
      { name: "tests", type: "array", description: "List of mock test objects" },
      { name: "pagination", type: "object", description: "Pagination metadata (page, limit, totalCount, totalPages)" },
    ],
    notes: [
      "Returns isEnrolled=true for each test if the request includes valid student auth cookies",
      "Excludes mock tests associated with live tests",
    ],
  },
  {
    method: "GET",
    route: "/_api/tests/details",
    description: "Get detailed information about a single mock test package",
    auth: "none",
    category: "Tests",
    queryParams: [
      { name: "slug", type: "string", required: false, description: "The unique slug of the mock test" },
      { name: "id", type: "number", required: false, description: "ID of the mock test" },
    ],
    responseFields: [
      { name: "test", type: "object", description: "Full mock test details including items, ratings, and description" },
      { name: "isEnrolled", type: "boolean", description: "Whether the authenticated student is enrolled" },
      { name: "error", type: "string", description: "Error message if not found" },
    ],
    notes: [
      "At least one of 'slug' or 'id' must be provided. If both are given, 'slug' takes priority."
    ]
  },
  {
    method: "GET",
    route: "/_api/tests/by-subject",
    description: "Get mock tests grouped or filtered by subject",
    auth: "none",
    category: "Tests",
    queryParams: [
      { name: "subject", type: "string", required: false, description: "Subject name to filter by" },
      { name: "examSlug", type: "string", required: false, description: "Exam slug to filter by" },
    ],
    responseFields: [
      { name: "tests", type: "array", description: "Array of mock test objects matching the subject/exam" },
      { name: "total", type: "number", description: "Total count of matching tests" },
    ],
  },
  {
    method: "POST",
    route: "/_api/tests/enroll-free",
    description: "Enroll the authenticated student in a free mock test package",
    auth: "student",
    category: "Tests",
    bodyParams: [
      { name: "mockTestId", type: "number", required: true, description: "ID of the free mock test to enroll in" },
    ],
    responseFields: [
      { name: "success", type: "boolean", description: "True if enrollment was successful" },
      { name: "orderId", type: "number", description: "ID of the created order record" },
      { name: "error", type: "string", description: "Error message on failure" },
    ],
  },
  {
    method: "GET",
    route: "/_api/tests/leaderboard",
    description: "Get the leaderboard for a specific mock test",
    auth: "none",
    category: "Tests",
    queryParams: [
      { name: "mockTestId", type: "number", required: true, description: "ID of the mock test" },
      { name: "limit", type: "number", required: false, description: "Number of top entries to return (default: 10)" },
    ],
    responseFields: [
      { name: "leaderboard", type: "array", description: "Ranked list of students with scores" },
      { name: "total", type: "number", description: "Total number of attempts for this test" },
    ],
  },
];