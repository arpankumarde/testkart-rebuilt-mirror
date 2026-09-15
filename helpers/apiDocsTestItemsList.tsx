import { ApiEndpoint } from "./apiDocsTypes";

export const apiDocsTestItemsList: ApiEndpoint[] = [
  {
    method: "GET",
    route: "/_api/test-items/details",
    description: "Get details of a specific test item within a mock test package",
    auth: "none",
    category: "Test Items & Attempts",
    queryParams: [
      { name: "testItemId", type: "number", required: true, description: "ID of the test item" },
    ],
    responseFields: [
      { name: "testItem", type: "object", description: "Test item details including duration, subject, and question count" },
      { name: "error", type: "string", description: "Error message if not found" },
    ],
  },
  {
    method: "GET",
    route: "/_api/student/test-item/questions",
    description: "Fetch all questions for a test item to attempt (sensitive answer fields omitted)",
    auth: "student",
    category: "Test Items & Attempts",
    queryParams: [
      { name: "testItemId", type: "number", required: true, description: "ID of the test item" },
    ],
    responseFields: [
      { name: "questions", type: "array", description: "Array of question objects (correctOption and explanation omitted)" },
      { name: "calculatorEnabled", type: "boolean", description: "Whether a calculator is allowed for this test" },
    ],
    notes: ["Requires the student to have purchased the parent mock test package"],
  },
  {
    method: "POST",
    route: "/_api/student/test-item/start-attempt",
    description: "Create a new test attempt record for a student",
    auth: "student",
    category: "Test Items & Attempts",
    bodyParams: [
      { name: "testItemId", type: "number", required: true, description: "ID of the test item to attempt" },
    ],
    responseFields: [
      { name: "attemptId", type: "number", description: "ID of the newly created attempt" },
      { name: "startedAt", type: "Date", description: "Timestamp when the attempt was started" },
    ],
    notes: [
      "Live tests enforce a maximum of 1 attempt per student",
      "Returns 403 if the test is scheduled for a future date",
    ],
  },
  {
    method: "POST",
    route: "/_api/student/test-item/submit-attempt",
    description: "Submit answers for a test attempt, calculates and stores the score",
    auth: "student",
    category: "Test Items & Attempts",
    bodyParams: [
      { name: "attemptId", type: "number", required: true, description: "ID of the attempt to submit" },
      { name: "answers", type: "array", required: true, description: "Array of student answers (discriminated union by answerType: single, multiple, numerical, match)" },
    ],
    responseFields: [
      { name: "score", type: "number", description: "Percentage score achieved" },
      { name: "totalMarks", type: "number", description: "Total marks obtained" },
      { name: "maxPossibleMarks", type: "number", description: "Maximum marks achievable for this test" },
      { name: "correctAnswers", type: "number", description: "Number of fully correct answers" },
      { name: "results", type: "array", description: "Detailed per-question result including correct answers and marks" },
    ],
    notes: [
      "Validates subject/section attempt limits before scoring",
      "Triggers a test completion email notification",
    ],
  },
  {
    method: "GET",
    route: "/_api/student/test-attempts/latest-results",
    description: "Get the latest completed attempt results for a specific test item",
    auth: "student",
    category: "Test Items & Attempts",
    queryParams: [
      { name: "testItemId", type: "number", required: true, description: "ID of the test item" },
    ],
    responseFields: [
      { name: "attempt", type: "object", description: "Latest attempt details including score and completion time" },
      { name: "results", type: "array", description: "Per-question results from the latest attempt" },
    ],
  },
  {
    method: "GET",
    route: "/_api/student/enrolled-tests",
    description: "Get all mock test packages the authenticated student is enrolled in",
    auth: "student",
    category: "Test Items & Attempts",
    queryParams: [
      { name: "page", type: "number", required: false, description: "Page number (default: 1)" },
      { name: "limit", type: "number", required: false, description: "Items per page (default: 20)" },
    ],
    responseFields: [
      { name: "tests", type: "array", description: "Array of enrolled mock test package objects" },
      { name: "total", type: "number", description: "Total number of enrolled tests" },
    ],
  },
];