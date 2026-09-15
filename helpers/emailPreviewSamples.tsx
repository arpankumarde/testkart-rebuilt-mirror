/**
 * Sample values used to fill {{placeholders}} when previewing or test-sending a
 * template, so the result reads like a real email instead of raw braces.
 *
 * Shared by the admin preview pane and endpoints/admin/email-templates/send-test
 * so both render identically. Add a key here when a template gains a new
 * placeholder; anything missing falls back to a readable label.
 */

export const PLACEHOLDER_SAMPLES: Record<string, string> = {
  adminNotes: "Please add a clearer explanation to question 4.",
  amount: "1,499",
  bundleName: "JEE Main 2026 Complete Bundle",
  category: "Engineering Entrance",
  certificateNumber: "TK-CERT-2026-004821",
  contentTitle: "Physics Mock Test 12",
  contentType: "mock test",
  correctAnswers: "42",
  courseName: "Complete Physics for JEE Main",
  date: "12 September 2026",
  discountAmount: "300",
  displayName: "Ananya Sharma",
  email: "ananya.sharma@example.com",
  endDate: "11 October 2026",
  itemName: "JEE Main Full Syllabus Mock Test",
  itemType: "Mock Test",
  items: "JEE Main Full Syllabus Mock Test, Physics Crash Course",
  liveTestId: "8421",
  maxPossibleMarks: "300",
  message: "I would like to know more about the teacher subscription plans.",
  messagePreview: "I would like to know more about the teacher subscription...",
  name: "Ananya Sharma",
  newEndDate: "11 November 2026",
  newPlanName: "Pro Annual",
  oldPlanName: "Starter Monthly",
  orderId: "TK20260912004821",
  phone: "+91 98765 43210",
  planName: "Pro Annual",
  productName: "JEE Main Formula Handbook",
  promoCode: "WELCOME300",
  rating: "5",
  reason: "The uploaded file was not readable.",
  resetLink: "https://testkart.in/reset-password?token=sample",
  reviewLink: "https://testkart.in/review/8421",
  reviewText: "Really well structured test series. The explanations helped a lot.",
  scheduledDate: "15 September 2026, 10:00 AM",
  score: "168",
  sponsorName: "Rahul Verma",
  startDate: "11 September 2026",
  status: "Processed",
  studentName: "Ananya Sharma",
  subject: "Question about my subscription",
  teacherId: "312",
  teacherName: "Rahul Verma",
  testName: "JEE Main Full Syllabus Mock Test",
  totalAmount: "1,499",
  totalMarks: "300",
  totalQuestions: "75",
  transactionId: "PAYU20260912X8421",
};

const PLACEHOLDER_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

/** Every distinct placeholder name appearing in the given strings. */
export const extractPlaceholders = (...parts: (string | null | undefined)[]) => {
  const found = new Set<string>();
  for (const part of parts) {
    if (!part) continue;
    for (const match of part.matchAll(PLACEHOLDER_PATTERN)) {
      found.add(match[1]);
    }
  }
  return Array.from(found).sort();
};

export const getSampleValue = (placeholder: string) =>
  PLACEHOLDER_SAMPLES[placeholder] ?? `Sample ${placeholder}`;

/** Replaces every {{placeholder}} with its sample value. */
export const fillWithSamples = (content: string | null | undefined): string => {
  if (!content) return "";
  return content.replace(PLACEHOLDER_PATTERN, (_, name: string) =>
    getSampleValue(name)
  );
};
