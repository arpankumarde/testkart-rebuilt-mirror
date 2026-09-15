import { ApiEndpoint } from "./apiDocsTypes";

export const apiDocsLiveTestsList: ApiEndpoint[] = [
  {
    method: "GET",
    route: "/_api/live-tests/list",
    description: "List active live tests with optional filtering",
    auth: "none",
    category: "Live Tests",
    queryParams: [
      { name: "status", type: "string", required: false, description: "'upcoming', 'live', 'ended', 'registration_closed', 'seats_full', or 'all'" },
      { name: "examName", type: "string", required: false, description: "Filter by exam name (partial match)" },
      { name: "searchQuery", type: "string", required: false, description: "Search across title, description, and teacher name" },
      { name: "page", type: "number", required: false, description: "Page number (default: 1)" },
      { name: "limit", type: "number", required: false, description: "Items per page (default: 10)" },
    ],
    responseFields: [
      { name: "tests", type: "array", description: "Array of live test objects with computed status" },
      { name: "total", type: "number", description: "Total count matching the filter" },
      { name: "page", type: "number", description: "Current page number" },
      { name: "limit", type: "number", description: "Items per page" },
    ],
    notes: [
      "Returns isEnrolled and hasAttempted if the request includes valid student auth cookies",
      "By default (no status filter), ended tests are hidden",
    ],
  },
  {
    method: "GET",
    route: "/_api/live-tests/details",
    description: "Get detailed information about a single live test",
    auth: "none",
    category: "Live Tests",
    queryParams: [
      { name: "id", type: "number", required: true, description: "ID of the live test" },
    ],
    responseFields: [
      { name: "test", type: "object", description: "Full live test details including prize info and enrollment count" },
      { name: "isEnrolled", type: "boolean", description: "Whether the authenticated student is enrolled" },
      { name: "error", type: "string", description: "Error message if not found" },
    ],
  },
  {
    method: "POST",
    route: "/_api/live-tests/enroll",
    description: "Enroll the authenticated student in a free live test",
    auth: "student",
    category: "Live Tests",
    bodyParams: [
      { name: "liveTestId", type: "number", required: true, description: "ID of the live test to enroll in" },
    ],
    responseFields: [
      { name: "success", type: "boolean", description: "True if enrollment was successful" },
      { name: "enrollmentId", type: "number", description: "ID of the new enrollment record" },
      { name: "error", type: "string", description: "Error message on failure" },
    ],
  },
  {
    method: "POST",
    route: "/_api/live-tests/purchase",
    description: "Initiate purchase flow for a paid live test",
    auth: "student",
    category: "Live Tests",
    bodyParams: [
      { name: "liveTestId", type: "number", required: true, description: "ID of the live test to purchase" },
      { name: "promoCode", type: "string", required: false, description: "Optional promo code to apply" },
    ],
    responseFields: [
      { name: "orderId", type: "number", description: "Created order ID" },
      { name: "paymentUrl", type: "string", description: "URL to redirect the user to complete payment" },
      { name: "error", type: "string", description: "Error message on failure" },
    ],
  },
  {
    method: "GET",
    route: "/_api/live-tests/leaderboard",
    description: "Get the leaderboard for a specific live test",
    auth: "none",
    category: "Live Tests",
    queryParams: [
      { name: "liveTestId", type: "number", required: true, description: "ID of the live test" },
      { name: "limit", type: "number", required: false, description: "Number of top entries to return (default: 20)" },
    ],
    responseFields: [
      { name: "leaderboard", type: "array", description: "Ranked list of students with scores and prize info" },
      { name: "total", type: "number", description: "Total number of participants" },
    ],
  },
  {
    method: "GET",
    route: "/_api/live-tests/check-enrollment",
    description: "Check if the authenticated student is enrolled in a live test",
    auth: "student",
    category: "Live Tests",
    queryParams: [
      { name: "liveTestId", type: "number", required: true, description: "ID of the live test" },
    ],
    responseFields: [
      { name: "isEnrolled", type: "boolean", description: "True if the student is enrolled" },
      { name: "enrolledAt", type: "Date", description: "Timestamp when the student enrolled" },
    ],
  },
  {
    method: "GET",
    route: "/_api/student/enrolled-live-tests",
    description: "Get all live tests the authenticated student is enrolled in",
    auth: "student",
    category: "Live Tests",
    queryParams: [
      { name: "page", type: "number", required: false, description: "Page number (default: 1)" },
      { name: "limit", type: "number", required: false, description: "Items per page (default: 10)" },
    ],
    responseFields: [
      { name: "tests", type: "array", description: "Array of enrolled live test objects with computed status" },
      { name: "total", type: "number", description: "Total number of enrolled live tests" },
    ],
  },
];