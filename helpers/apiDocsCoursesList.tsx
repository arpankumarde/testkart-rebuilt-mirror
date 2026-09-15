import { ApiEndpoint } from "./apiDocsTypes";

export const apiDocsCoursesList: ApiEndpoint[] = [
  {
    method: "GET",
    route: "/_api/courses/list",
    description: "List all published courses with optional filtering and sorting",
    auth: "none",
    category: "Courses",
    queryParams: [
      { name: "search", type: "string", required: false, description: "Search across title and description" },
      { name: "category", type: "string", required: false, description: "Filter by exact category name" },
      { name: "level", type: "string", required: false, description: "Filter by level: 'beginner', 'intermediate', or 'advanced'" },
      { name: "language", type: "string", required: false, description: "Comma-separated list of languages to filter by" },
      { name: "priceType", type: "string", required: false, description: "'free', 'paid', or 'all'" },
      { name: "minPrice", type: "number", required: false, description: "Minimum price (used with priceType=paid)" },
      { name: "maxPrice", type: "number", required: false, description: "Maximum price (used with priceType=paid)" },
      { name: "sortBy", type: "string", required: false, description: "'newest', 'price_asc', 'price_desc', or 'popular'" },
      { name: "page", type: "number", required: false, description: "Page number (default: 1)" },
      { name: "limit", type: "number", required: false, description: "Items per page (default: 6)" },
    ],
    responseFields: [
      { name: "courses", type: "array", description: "Array of course objects with teacher and enrollment info" },
      { name: "categories", type: "array", description: "Sorted list of distinct category strings from published courses" },
      { name: "pagination", type: "object", description: "Pagination metadata (page, limit, totalCount, totalPages)" },
    ],
  },
  {
    method: "GET",
    route: "/_api/courses/details",
    description: "Get detailed information about a single course",
    auth: "none",
    category: "Courses",
    queryParams: [
      { name: "slug", type: "string", required: true, description: "The unique slug of the course" },
    ],
    responseFields: [
      { name: "course", type: "object", description: "Full course details including sections, lessons, and teacher info" },
      { name: "isEnrolled", type: "boolean", description: "Whether the authenticated student is enrolled" },
      { name: "error", type: "string", description: "Error message if not found" },
    ],
  },
  {
    method: "POST",
    route: "/_api/courses/enroll-free",
    description: "Enroll the authenticated student in a free course",
    auth: "student",
    category: "Courses",
    bodyParams: [
      { name: "courseId", type: "number", required: true, description: "ID of the free course to enroll in" },
    ],
    responseFields: [
      { name: "success", type: "boolean", description: "True if enrollment was successful" },
      { name: "enrollmentId", type: "number", description: "ID of the new enrollment record" },
      { name: "error", type: "string", description: "Error message on failure" },
    ],
  },
  {
    method: "POST",
    route: "/_api/courses/purchase",
    description: "Initiate purchase flow for a paid course",
    auth: "student",
    category: "Courses",
    bodyParams: [
      { name: "courseId", type: "number", required: true, description: "ID of the course to purchase" },
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
    route: "/_api/student/enrolled-courses",
    description: "Get all courses the authenticated student is enrolled in",
    auth: "student",
    category: "Courses",
    queryParams: [
      { name: "page", type: "number", required: false, description: "Page number (default: 1)" },
      { name: "limit", type: "number", required: false, description: "Items per page (default: 10)" },
    ],
    responseFields: [
      { name: "courses", type: "array", description: "Array of enrolled course objects with completion percentage" },
      { name: "total", type: "number", description: "Total number of enrolled courses" },
    ],
  },
  {
    method: "GET",
    route: "/_api/student/course/lessons",
    description: "Get all lessons for a course the student is enrolled in",
    auth: "student",
    category: "Courses",
    queryParams: [
      { name: "courseId", type: "number", required: true, description: "ID of the enrolled course" },
    ],
    responseFields: [
      { name: "sections", type: "array", description: "Array of course sections, each containing an array of lessons" },
      { name: "progress", type: "object", description: "Map of lessonId to completion status" },
    ],
  },
  {
    method: "GET",
    route: "/_api/student/course/progress",
    description: "Get the student's progress for a specific course",
    auth: "student",
    category: "Courses",
    queryParams: [
      { name: "courseId", type: "number", required: true, description: "ID of the course" },
    ],
    responseFields: [
      { name: "completionPercentage", type: "number", description: "Percentage of lessons completed" },
      { name: "completedLessonIds", type: "array", description: "Array of completed lesson IDs" },
      { name: "lastAccessedAt", type: "Date", description: "Timestamp of last access" },
    ],
  },
  {
    method: "POST",
    route: "/_api/student/course/mark-complete",
    description: "Mark a specific lesson as complete for the authenticated student",
    auth: "student",
    category: "Courses",
    bodyParams: [
      { name: "lessonId", type: "number", required: true, description: "ID of the lesson to mark complete" },
    ],
    responseFields: [
      { name: "success", type: "boolean", description: "True if the lesson was marked complete" },
      { name: "completionPercentage", type: "number", description: "Updated course completion percentage" },
    ],
  },
  {
    method: "POST",
    route: "/_api/student/course/mark-incomplete",
    description: "Mark a specific lesson as incomplete for the authenticated student",
    auth: "student",
    category: "Courses",
    bodyParams: [
      { name: "lessonId", type: "number", required: true, description: "ID of the lesson to mark incomplete" },
    ],
    responseFields: [
      { name: "success", type: "boolean", description: "True if the lesson was marked incomplete" },
      { name: "completionPercentage", type: "number", description: "Updated course completion percentage" },
    ],
  },
  {
    method: "POST",
    route: "/_api/student/course/signed-video-url",
    description: "Get a signed URL to securely stream a video lesson",
    auth: "student",
    category: "Courses",
    bodyParams: [
      { name: "lessonId", type: "number", required: true, description: "ID of the video lesson" },
    ],
    responseFields: [
      { name: "signedUrl", type: "string", description: "Time-limited signed URL to stream the video" },
      { name: "expiresAt", type: "Date", description: "Expiry timestamp of the signed URL" },
    ],
    notes: ["Requires the student to be enrolled in the parent course"],
  },
];