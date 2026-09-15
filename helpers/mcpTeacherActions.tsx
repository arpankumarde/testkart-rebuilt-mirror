/**
 * Bridges the teacher MCP connector onto the existing teacher endpoints.
 *
 * Floot forbids an endpoint from fetching another endpoint, so each teacher endpoint's `handle` is
 * imported and invoked with a synthetic Request. The Request carries a short-lived session JWT for
 * the connection's own row in `sessions`, so every endpoint applies its usual auth, ownership
 * checks, team-manager resolution and validation.
 *
 * Input schemas come from each endpoint's own zod schema, converted to JSON Schema on demand, so
 * the connector cannot drift from what an endpoint accepts.
 */

import superjson from "superjson";
import type { ZodTypeAny } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { createServerSessionToken } from "./getSetServerSession";
import { getServerUserSession } from "./getServerUserSession";
import type { McpAccess } from "./mcpOauth";
import { extractEndpointError, unwrapEndpointPayload } from "./mcpServer";
import { SITE_ORIGIN } from "./shareLinks";

import { handle as bankDetails } from "../endpoints/teacher/bank-details_GET";
import * as bankDetailsSchema from "../endpoints/teacher/bank-details_GET.schema";
import { handle as bundlesDetails } from "../endpoints/teacher/bundles/details_GET";
import * as bundlesDetailsSchema from "../endpoints/teacher/bundles/details_GET.schema";
import { handle as bundlesList } from "../endpoints/teacher/bundles/list_GET";
import * as bundlesListSchema from "../endpoints/teacher/bundles/list_GET.schema";
import { handle as certificatesIssued } from "../endpoints/teacher/certificates/issued_GET";
import * as certificatesIssuedSchema from "../endpoints/teacher/certificates/issued_GET.schema";
import { handle as coursesDetails } from "../endpoints/teacher/courses/details_GET";
import * as coursesDetailsSchema from "../endpoints/teacher/courses/details_GET.schema";
import { handle as coursesList } from "../endpoints/teacher/courses/list_GET";
import * as coursesListSchema from "../endpoints/teacher/courses/list_GET.schema";
import { handle as dashboardOverview } from "../endpoints/teacher/dashboard/overview_GET";
import * as dashboardOverviewSchema from "../endpoints/teacher/dashboard/overview_GET.schema";
import { handle as dashboardStats } from "../endpoints/teacher/dashboard/stats_GET";
import * as dashboardStatsSchema from "../endpoints/teacher/dashboard/stats_GET.schema";
import { handle as earningsBalance } from "../endpoints/teacher/earnings/balance_GET";
import * as earningsBalanceSchema from "../endpoints/teacher/earnings/balance_GET.schema";
import { handle as earningsList } from "../endpoints/teacher/earnings/list_GET";
import * as earningsListSchema from "../endpoints/teacher/earnings/list_GET.schema";
import { handle as examSubjectsByExam } from "../endpoints/teacher/exam-subjects/by-exam_GET";
import * as examSubjectsByExamSchema from "../endpoints/teacher/exam-subjects/by-exam_GET.schema";
import { handle as examsList } from "../endpoints/teacher/exams/list_GET";
import * as examsListSchema from "../endpoints/teacher/exams/list_GET.schema";
import { handle as liveTestDetails } from "../endpoints/teacher/live-test/details_GET";
import * as liveTestDetailsSchema from "../endpoints/teacher/live-test/details_GET.schema";
import { handle as liveTestsAnalytics } from "../endpoints/teacher/live-tests/analytics_GET";
import * as liveTestsAnalyticsSchema from "../endpoints/teacher/live-tests/analytics_GET.schema";
import { handle as liveTestsList } from "../endpoints/teacher/live-tests/list_GET";
import * as liveTestsListSchema from "../endpoints/teacher/live-tests/list_GET.schema";
import { handle as productsDetails } from "../endpoints/teacher/products/details_GET";
import * as productsDetailsSchema from "../endpoints/teacher/products/details_GET.schema";
import { handle as productsList } from "../endpoints/teacher/products/list_GET";
import * as productsListSchema from "../endpoints/teacher/products/list_GET.schema";
import { handle as promoCodesList } from "../endpoints/teacher/promo-codes/list_GET";
import * as promoCodesListSchema from "../endpoints/teacher/promo-codes/list_GET.schema";
import { handle as questionBankList } from "../endpoints/teacher/question-bank/list_GET";
import * as questionBankListSchema from "../endpoints/teacher/question-bank/list_GET.schema";
import { handle as questionsBySubject } from "../endpoints/teacher/questions/by-subject_GET";
import * as questionsBySubjectSchema from "../endpoints/teacher/questions/by-subject_GET.schema";
import { handle as questionsList } from "../endpoints/teacher/questions/list_GET";
import * as questionsListSchema from "../endpoints/teacher/questions/list_GET.schema";
import { handle as reviewsLatest } from "../endpoints/teacher/reviews/latest_GET";
import * as reviewsLatestSchema from "../endpoints/teacher/reviews/latest_GET.schema";
import { handle as sponsorStudentList } from "../endpoints/teacher/sponsor-student/list_GET";
import * as sponsorStudentListSchema from "../endpoints/teacher/sponsor-student/list_GET.schema";
import { handle as studentsList } from "../endpoints/teacher/students/list_GET";
import * as studentsListSchema from "../endpoints/teacher/students/list_GET.schema";
import { handle as subjectSectionsList } from "../endpoints/teacher/subject-sections/list_GET";
import * as subjectSectionsListSchema from "../endpoints/teacher/subject-sections/list_GET.schema";
import { handle as subscriptionHistory } from "../endpoints/teacher/subscription/history_GET";
import * as subscriptionHistorySchema from "../endpoints/teacher/subscription/history_GET.schema";
import { handle as subscriptionMandateStatus } from "../endpoints/teacher/subscription/mandate/status_GET";
import * as subscriptionMandateStatusSchema from "../endpoints/teacher/subscription/mandate/status_GET.schema";
import { handle as subscriptionPaymentInfo } from "../endpoints/teacher/subscription/payment-info_GET";
import * as subscriptionPaymentInfoSchema from "../endpoints/teacher/subscription/payment-info_GET.schema";
import { handle as subscriptionPlans } from "../endpoints/teacher/subscription/plans_GET";
import * as subscriptionPlansSchema from "../endpoints/teacher/subscription/plans_GET.schema";
import { handle as subscriptionStatus } from "../endpoints/teacher/subscription/status_GET";
import * as subscriptionStatusSchema from "../endpoints/teacher/subscription/status_GET.schema";
import { handle as supportThreadMessages } from "../endpoints/teacher/support/thread/messages_GET";
import * as supportThreadMessagesSchema from "../endpoints/teacher/support/thread/messages_GET.schema";
import { handle as supportThreads } from "../endpoints/teacher/support/threads_GET";
import * as supportThreadsSchema from "../endpoints/teacher/support/threads_GET.schema";
import { handle as teamList } from "../endpoints/teacher/team/list_GET";
import * as teamListSchema from "../endpoints/teacher/team/list_GET.schema";
import { handle as testItemSubjectsList } from "../endpoints/teacher/test-item-subjects/list_GET";
import * as testItemSubjectsListSchema from "../endpoints/teacher/test-item-subjects/list_GET.schema";
import { handle as testItemsList } from "../endpoints/teacher/test-items/list_GET";
import * as testItemsListSchema from "../endpoints/teacher/test-items/list_GET.schema";
import { handle as testsList } from "../endpoints/teacher/tests/list_GET";
import * as testsListSchema from "../endpoints/teacher/tests/list_GET.schema";
import { handle as trashList } from "../endpoints/teacher/trash/list_GET";
import * as trashListSchema from "../endpoints/teacher/trash/list_GET.schema";
import { handle as withdrawalList } from "../endpoints/teacher/withdrawal/list_GET";
import * as withdrawalListSchema from "../endpoints/teacher/withdrawal/list_GET.schema";
import { handle as workExperiencesList } from "../endpoints/teacher/work-experiences/list_GET";
import * as workExperiencesListSchema from "../endpoints/teacher/work-experiences/list_GET.schema";

import { handle as academyUpdate } from "../endpoints/teacher/academy/update_POST";
import * as academyUpdateSchema from "../endpoints/teacher/academy/update_POST.schema";
import { handle as aiGenerateAll } from "../endpoints/teacher/ai/generate-all_POST";
import * as aiGenerateAllSchema from "../endpoints/teacher/ai/generate-all_POST.schema";
import { handle as aiGenerateDistractors } from "../endpoints/teacher/ai/generate-distractors_POST";
import * as aiGenerateDistractorsSchema from "../endpoints/teacher/ai/generate-distractors_POST.schema";
import { handle as aiGenerateList } from "../endpoints/teacher/ai/generate-list_POST";
import * as aiGenerateListSchema from "../endpoints/teacher/ai/generate-list_POST.schema";
import { handle as aiRewrite } from "../endpoints/teacher/ai/rewrite_POST";
import * as aiRewriteSchema from "../endpoints/teacher/ai/rewrite_POST.schema";
import { handle as bankDetailsAdd } from "../endpoints/teacher/bank-details/add_POST";
import * as bankDetailsAddSchema from "../endpoints/teacher/bank-details/add_POST.schema";
import { handle as bundlesCreate } from "../endpoints/teacher/bundles/create_POST";
import * as bundlesCreateSchema from "../endpoints/teacher/bundles/create_POST.schema";
import { handle as bundlesDelete } from "../endpoints/teacher/bundles/delete_POST";
import * as bundlesDeleteSchema from "../endpoints/teacher/bundles/delete_POST.schema";
import { handle as bundlesPublish } from "../endpoints/teacher/bundles/publish_POST";
import * as bundlesPublishSchema from "../endpoints/teacher/bundles/publish_POST.schema";
import { handle as bundlesUpdate } from "../endpoints/teacher/bundles/update_POST";
import * as bundlesUpdateSchema from "../endpoints/teacher/bundles/update_POST.schema";
import { handle as courseLessonsCreate } from "../endpoints/teacher/course-lessons/create_POST";
import * as courseLessonsCreateSchema from "../endpoints/teacher/course-lessons/create_POST.schema";
import { handle as courseLessonsDelete } from "../endpoints/teacher/course-lessons/delete_POST";
import * as courseLessonsDeleteSchema from "../endpoints/teacher/course-lessons/delete_POST.schema";
import { handle as courseLessonsReorder } from "../endpoints/teacher/course-lessons/reorder_POST";
import * as courseLessonsReorderSchema from "../endpoints/teacher/course-lessons/reorder_POST.schema";
import { handle as courseLessonsUpdate } from "../endpoints/teacher/course-lessons/update_POST";
import * as courseLessonsUpdateSchema from "../endpoints/teacher/course-lessons/update_POST.schema";
import { handle as courseSectionsCreate } from "../endpoints/teacher/course-sections/create_POST";
import * as courseSectionsCreateSchema from "../endpoints/teacher/course-sections/create_POST.schema";
import { handle as courseSectionsDelete } from "../endpoints/teacher/course-sections/delete_POST";
import * as courseSectionsDeleteSchema from "../endpoints/teacher/course-sections/delete_POST.schema";
import { handle as courseSectionsReorder } from "../endpoints/teacher/course-sections/reorder_POST";
import * as courseSectionsReorderSchema from "../endpoints/teacher/course-sections/reorder_POST.schema";
import { handle as courseSectionsUpdate } from "../endpoints/teacher/course-sections/update_POST";
import * as courseSectionsUpdateSchema from "../endpoints/teacher/course-sections/update_POST.schema";
import { handle as coursesCreate } from "../endpoints/teacher/courses/create_POST";
import * as coursesCreateSchema from "../endpoints/teacher/courses/create_POST.schema";
import { handle as coursesDelete } from "../endpoints/teacher/courses/delete_POST";
import * as coursesDeleteSchema from "../endpoints/teacher/courses/delete_POST.schema";
import { handle as coursesPublish } from "../endpoints/teacher/courses/publish_POST";
import * as coursesPublishSchema from "../endpoints/teacher/courses/publish_POST.schema";
import { handle as coursesUnpublish } from "../endpoints/teacher/courses/unpublish_POST";
import * as coursesUnpublishSchema from "../endpoints/teacher/courses/unpublish_POST.schema";
import { handle as coursesUpdate } from "../endpoints/teacher/courses/update_POST";
import * as coursesUpdateSchema from "../endpoints/teacher/courses/update_POST.schema";
import { handle as editorImagesUpload } from "../endpoints/teacher/editor-images/upload_POST";
import * as editorImagesUploadSchema from "../endpoints/teacher/editor-images/upload_POST.schema";
import { handle as editorImagesUploadUrl } from "../endpoints/teacher/editor-images/upload-url_POST";
import * as editorImagesUploadUrlSchema from "../endpoints/teacher/editor-images/upload-url_POST.schema";
import { handle as inquiry } from "../endpoints/teacher/inquiry_POST";
import * as inquirySchema from "../endpoints/teacher/inquiry_POST.schema";
import { handle as liveTestPublish } from "../endpoints/teacher/live-test/publish_POST";
import * as liveTestPublishSchema from "../endpoints/teacher/live-test/publish_POST.schema";
import { handle as liveTestsCreate } from "../endpoints/teacher/live-tests/create_POST";
import * as liveTestsCreateSchema from "../endpoints/teacher/live-tests/create_POST.schema";
import { handle as liveTestsDelete } from "../endpoints/teacher/live-tests/delete_POST";
import * as liveTestsDeleteSchema from "../endpoints/teacher/live-tests/delete_POST.schema";
import { handle as liveTestsDuplicate } from "../endpoints/teacher/live-tests/duplicate_POST";
import * as liveTestsDuplicateSchema from "../endpoints/teacher/live-tests/duplicate_POST.schema";
import { handle as liveTestsPublish } from "../endpoints/teacher/live-tests/publish_POST";
import * as liveTestsPublishSchema from "../endpoints/teacher/live-tests/publish_POST.schema";
import { handle as liveTestsUnpublish } from "../endpoints/teacher/live-tests/unpublish_POST";
import * as liveTestsUnpublishSchema from "../endpoints/teacher/live-tests/unpublish_POST.schema";
import { handle as liveTestsUpdate } from "../endpoints/teacher/live-tests/update_POST";
import * as liveTestsUpdateSchema from "../endpoints/teacher/live-tests/update_POST.schema";
import { handle as onboardingComplete } from "../endpoints/teacher/onboarding/complete_POST";
import * as onboardingCompleteSchema from "../endpoints/teacher/onboarding/complete_POST.schema";
import { handle as productsAnalyzePdf } from "../endpoints/teacher/products/analyze-pdf_POST";
import * as productsAnalyzePdfSchema from "../endpoints/teacher/products/analyze-pdf_POST.schema";
import { handle as productsBulk } from "../endpoints/teacher/products/bulk_POST";
import * as productsBulkSchema from "../endpoints/teacher/products/bulk_POST.schema";
import { handle as productsCreate } from "../endpoints/teacher/products/create_POST";
import * as productsCreateSchema from "../endpoints/teacher/products/create_POST.schema";
import { handle as productsDelete } from "../endpoints/teacher/products/delete_POST";
import * as productsDeleteSchema from "../endpoints/teacher/products/delete_POST.schema";
import { handle as productsPdfPageCount } from "../endpoints/teacher/products/pdf-page-count_POST";
import * as productsPdfPageCountSchema from "../endpoints/teacher/products/pdf-page-count_POST.schema";
import { handle as productsPublish } from "../endpoints/teacher/products/publish_POST";
import * as productsPublishSchema from "../endpoints/teacher/products/publish_POST.schema";
import { handle as productsUnpublish } from "../endpoints/teacher/products/unpublish_POST";
import * as productsUnpublishSchema from "../endpoints/teacher/products/unpublish_POST.schema";
import { handle as productsUpdate } from "../endpoints/teacher/products/update_POST";
import * as productsUpdateSchema from "../endpoints/teacher/products/update_POST.schema";
import { handle as profileUpdate } from "../endpoints/teacher/profile/update_POST";
import * as profileUpdateSchema from "../endpoints/teacher/profile/update_POST.schema";
import { handle as promoCodesDelete } from "../endpoints/teacher/promo-codes/delete_POST";
import * as promoCodesDeleteSchema from "../endpoints/teacher/promo-codes/delete_POST.schema";
import { handle as questionBankBulkUpload } from "../endpoints/teacher/question-bank/bulk-upload_POST";
import * as questionBankBulkUploadSchema from "../endpoints/teacher/question-bank/bulk-upload_POST.schema";
import { handle as questionBankCreate } from "../endpoints/teacher/question-bank/create_POST";
import * as questionBankCreateSchema from "../endpoints/teacher/question-bank/create_POST.schema";
import { handle as questionBankDelete } from "../endpoints/teacher/question-bank/delete_POST";
import * as questionBankDeleteSchema from "../endpoints/teacher/question-bank/delete_POST.schema";
import { handle as questionBankImportToTest } from "../endpoints/teacher/question-bank/import-to-test_POST";
import * as questionBankImportToTestSchema from "../endpoints/teacher/question-bank/import-to-test_POST.schema";
import { handle as questionBankSaveFromTest } from "../endpoints/teacher/question-bank/save-from-test_POST";
import * as questionBankSaveFromTestSchema from "../endpoints/teacher/question-bank/save-from-test_POST.schema";
import { handle as questionBankUpdate } from "../endpoints/teacher/question-bank/update_POST";
import * as questionBankUpdateSchema from "../endpoints/teacher/question-bank/update_POST.schema";
import { handle as questionsAcceptAi } from "../endpoints/teacher/questions/accept-ai_POST";
import * as questionsAcceptAiSchema from "../endpoints/teacher/questions/accept-ai_POST.schema";
import { handle as questionsAssignSections } from "../endpoints/teacher/questions/assign-sections_POST";
import * as questionsAssignSectionsSchema from "../endpoints/teacher/questions/assign-sections_POST.schema";
import { handle as questionsBulkUpdateMarks } from "../endpoints/teacher/questions/bulk-update-marks_POST";
import * as questionsBulkUpdateMarksSchema from "../endpoints/teacher/questions/bulk-update-marks_POST.schema";
import { handle as questionsBulkUpdateTiming } from "../endpoints/teacher/questions/bulk-update-timing_POST";
import * as questionsBulkUpdateTimingSchema from "../endpoints/teacher/questions/bulk-update-timing_POST.schema";
import { handle as questionsBulkUpload } from "../endpoints/teacher/questions/bulk-upload_POST";
import * as questionsBulkUploadSchema from "../endpoints/teacher/questions/bulk-upload_POST.schema";
import { handle as questionsCreate } from "../endpoints/teacher/questions/create_POST";
import * as questionsCreateSchema from "../endpoints/teacher/questions/create_POST.schema";
import { handle as questionsDelete } from "../endpoints/teacher/questions/delete_POST";
import * as questionsDeleteSchema from "../endpoints/teacher/questions/delete_POST.schema";
import { handle as questionsGenerateAi } from "../endpoints/teacher/questions/generate-ai_POST";
import * as questionsGenerateAiSchema from "../endpoints/teacher/questions/generate-ai_POST.schema";
import { handle as questionsReorder } from "../endpoints/teacher/questions/reorder_POST";
import * as questionsReorderSchema from "../endpoints/teacher/questions/reorder_POST.schema";
import { handle as questionsUpdate } from "../endpoints/teacher/questions/update_POST";
import * as questionsUpdateSchema from "../endpoints/teacher/questions/update_POST.schema";
import { handle as sponsorStudentCheck } from "../endpoints/teacher/sponsor-student/check_POST";
import * as sponsorStudentCheckSchema from "../endpoints/teacher/sponsor-student/check_POST.schema";
import { handle as sponsorStudentEnroll } from "../endpoints/teacher/sponsor-student/enroll_POST";
import * as sponsorStudentEnrollSchema from "../endpoints/teacher/sponsor-student/enroll_POST.schema";
import { handle as subjectSectionsCreate } from "../endpoints/teacher/subject-sections/create_POST";
import * as subjectSectionsCreateSchema from "../endpoints/teacher/subject-sections/create_POST.schema";
import { handle as subjectSectionsDelete } from "../endpoints/teacher/subject-sections/delete_POST";
import * as subjectSectionsDeleteSchema from "../endpoints/teacher/subject-sections/delete_POST.schema";
import { handle as subjectSectionsReorder } from "../endpoints/teacher/subject-sections/reorder_POST";
import * as subjectSectionsReorderSchema from "../endpoints/teacher/subject-sections/reorder_POST.schema";
import { handle as subjectSectionsUpdate } from "../endpoints/teacher/subject-sections/update_POST";
import * as subjectSectionsUpdateSchema from "../endpoints/teacher/subject-sections/update_POST.schema";
import { handle as subscriptionSubscribe } from "../endpoints/teacher/subscription/subscribe_POST";
import * as subscriptionSubscribeSchema from "../endpoints/teacher/subscription/subscribe_POST.schema";
import { handle as subscriptionWalletSubscribe } from "../endpoints/teacher/subscription/wallet-subscribe_POST";
import * as subscriptionWalletSubscribeSchema from "../endpoints/teacher/subscription/wallet-subscribe_POST.schema";
import { handle as supportThreadCreate } from "../endpoints/teacher/support/thread/create_POST";
import * as supportThreadCreateSchema from "../endpoints/teacher/support/thread/create_POST.schema";
import { handle as supportThreadReply } from "../endpoints/teacher/support/thread/reply_POST";
import * as supportThreadReplySchema from "../endpoints/teacher/support/thread/reply_POST.schema";
import { handle as teamInvite } from "../endpoints/teacher/team/invite_POST";
import * as teamInviteSchema from "../endpoints/teacher/team/invite_POST.schema";
import { handle as teamRemove } from "../endpoints/teacher/team/remove_POST";
import * as teamRemoveSchema from "../endpoints/teacher/team/remove_POST.schema";
import { handle as testItemSubjectsBulkCreate } from "../endpoints/teacher/test-item-subjects/bulk-create_POST";
import * as testItemSubjectsBulkCreateSchema from "../endpoints/teacher/test-item-subjects/bulk-create_POST.schema";
import { handle as testItemSubjectsCreate } from "../endpoints/teacher/test-item-subjects/create_POST";
import * as testItemSubjectsCreateSchema from "../endpoints/teacher/test-item-subjects/create_POST.schema";
import { handle as testItemSubjectsDelete } from "../endpoints/teacher/test-item-subjects/delete_POST";
import * as testItemSubjectsDeleteSchema from "../endpoints/teacher/test-item-subjects/delete_POST.schema";
import { handle as testItemSubjectsReorder } from "../endpoints/teacher/test-item-subjects/reorder_POST";
import * as testItemSubjectsReorderSchema from "../endpoints/teacher/test-item-subjects/reorder_POST.schema";
import { handle as testItemSubjectsUpdate } from "../endpoints/teacher/test-item-subjects/update_POST";
import * as testItemSubjectsUpdateSchema from "../endpoints/teacher/test-item-subjects/update_POST.schema";
import { handle as testItemsBulkCreate } from "../endpoints/teacher/test-items/bulk-create_POST";
import * as testItemsBulkCreateSchema from "../endpoints/teacher/test-items/bulk-create_POST.schema";
import { handle as testItemsCreate } from "../endpoints/teacher/test-items/create_POST";
import * as testItemsCreateSchema from "../endpoints/teacher/test-items/create_POST.schema";
import { handle as testItemsDelete } from "../endpoints/teacher/test-items/delete_POST";
import * as testItemsDeleteSchema from "../endpoints/teacher/test-items/delete_POST.schema";
import { handle as testItemsReorder } from "../endpoints/teacher/test-items/reorder_POST";
import * as testItemsReorderSchema from "../endpoints/teacher/test-items/reorder_POST.schema";
import { handle as testItemsUpdate } from "../endpoints/teacher/test-items/update_POST";
import * as testItemsUpdateSchema from "../endpoints/teacher/test-items/update_POST.schema";
import { handle as testsCreate } from "../endpoints/teacher/tests/create_POST";
import * as testsCreateSchema from "../endpoints/teacher/tests/create_POST.schema";
import { handle as testsCreateWithItems } from "../endpoints/teacher/tests/create-with-items_POST";
import * as testsCreateWithItemsSchema from "../endpoints/teacher/tests/create-with-items_POST.schema";
import { handle as testsDelete } from "../endpoints/teacher/tests/delete_POST";
import * as testsDeleteSchema from "../endpoints/teacher/tests/delete_POST.schema";
import { handle as testsPublish } from "../endpoints/teacher/tests/publish_POST";
import * as testsPublishSchema from "../endpoints/teacher/tests/publish_POST.schema";
import { handle as testsUnpublish } from "../endpoints/teacher/tests/unpublish_POST";
import * as testsUnpublishSchema from "../endpoints/teacher/tests/unpublish_POST.schema";
import { handle as testsUpdate } from "../endpoints/teacher/tests/update_POST";
import * as testsUpdateSchema from "../endpoints/teacher/tests/update_POST.schema";
import { handle as trashDelete } from "../endpoints/teacher/trash/delete_POST";
import * as trashDeleteSchema from "../endpoints/teacher/trash/delete_POST.schema";
import { handle as trashRestore } from "../endpoints/teacher/trash/restore_POST";
import * as trashRestoreSchema from "../endpoints/teacher/trash/restore_POST.schema";
import { handle as withdrawalRequest } from "../endpoints/teacher/withdrawal/request_POST";
import * as withdrawalRequestSchema from "../endpoints/teacher/withdrawal/request_POST.schema";
import { handle as workExperiencesCreate } from "../endpoints/teacher/work-experiences/create_POST";
import * as workExperiencesCreateSchema from "../endpoints/teacher/work-experiences/create_POST.schema";
import { handle as workExperiencesDelete } from "../endpoints/teacher/work-experiences/delete_POST";
import * as workExperiencesDeleteSchema from "../endpoints/teacher/work-experiences/delete_POST.schema";
import { handle as workExperiencesUpdate } from "../endpoints/teacher/work-experiences/update_POST";
import * as workExperiencesUpdateSchema from "../endpoints/teacher/work-experiences/update_POST.schema";

type EndpointHandler = (request: Request) => Promise<Response>;
type SchemaModule = { schema?: unknown };

export type TeacherActionKind = "read" | "write";
export type TeacherAccess = Extract<McpAccess, { audience: "teacher" }>;

type TeacherAction = {
  kind: TeacherActionKind;
  handler: EndpointHandler;
  schema: ZodTypeAny | null;
  summary: string;
  confirm: boolean;
  /** The endpoint reads request.json() rather than the superjson envelope. */
  plainJson: boolean;
};

export class McpTeacherToolError extends Error {}

function zodSchemaOf(module: SchemaModule): ZodTypeAny | null {
  const candidate = module.schema as { safeParse?: unknown } | undefined;
  return candidate && typeof candidate.safeParse === "function" ? (module.schema as ZodTypeAny) : null;
}

function read(handler: EndpointHandler, module: SchemaModule, summary: string): TeacherAction {
  return { kind: "read", handler, schema: zodSchemaOf(module), summary, confirm: false, plainJson: false };
}

function write(
  handler: EndpointHandler,
  module: SchemaModule,
  summary: string,
  options: { confirm?: boolean; plainJson?: boolean } = {}
): TeacherAction {
  return {
    kind: "write",
    handler,
    schema: zodSchemaOf(module),
    summary,
    confirm: options.confirm ?? false,
    plainJson: options.plainJson ?? false,
  };
}

const CONFIRM = { confirm: true };

/** Action name to endpoint. The name is the endpoint's path under /_api/teacher/. */
const ACTIONS: Record<string, TeacherAction> = {
  "bank-details": read(bankDetails, bankDetailsSchema, "Your saved bank account, UPI and PAN details for payouts."),
  "bundles/details": read(bundlesDetails, bundlesDetailsSchema, "One bundle with the tests, courses and study notes in it."),
  "bundles/list": read(bundlesList, bundlesListSchema, "Your bundles."),
  "certificates/issued": read(certificatesIssued, certificatesIssuedSchema, "Certificates issued to students for your courses and tests (page, limit)."),
  "courses/details": read(coursesDetails, coursesDetailsSchema, "One course with its sections and lessons."),
  "courses/list": read(coursesList, coursesListSchema, "Your courses with section and lesson counts."),
  "dashboard/overview": read(dashboardOverview, dashboardOverviewSchema, "Teacher dashboard overview."),
  "dashboard/stats": read(dashboardStats, dashboardStatsSchema, "Headline dashboard stats, including revenue and available balance."),
  "earnings/balance": read(earningsBalance, earningsBalanceSchema, "Your earnings balance, including what is available to withdraw."),
  "earnings/list": read(earningsList, earningsListSchema, "Your earnings transactions."),
  "exam-subjects/by-exam": read(examSubjectsByExam, examSubjectsByExamSchema, "Subjects defined for an exam."),
  "exams/list": read(examsList, examsListSchema, "Exams you can attach content to."),
  "live-test/details": read(liveTestDetails, liveTestDetailsSchema, "One live test with its test item and subjects (liveTestId)."),
  "live-tests/analytics": read(liveTestsAnalytics, liveTestsAnalyticsSchema, "Results and analytics for your live tests."),
  "live-tests/list": read(liveTestsList, liveTestsListSchema, "Your live tests."),
  "products/details": read(productsDetails, productsDetailsSchema, "One study notes product with its files."),
  "products/list": read(productsList, productsListSchema, "Your study notes (digital products)."),
  "promo-codes/list": read(promoCodesList, promoCodesListSchema, "Your promo codes."),
  "question-bank/list": read(questionBankList, questionBankListSchema, "Questions saved in your question bank."),
  "questions/by-subject": read(questionsBySubject, questionsBySubjectSchema, "Questions in one test subject."),
  "questions/list": read(questionsList, questionsListSchema, "Questions in one test item (testItemId)."),
  "reviews/latest": read(reviewsLatest, reviewsLatestSchema, "Latest student reviews of your content."),
  "sponsor-student/list": read(sponsorStudentList, sponsorStudentListSchema, "Students you have sponsored into your content."),
  "students/list": read(studentsList, studentsListSchema, "Students enrolled in your content."),
  "subject-sections/list": read(subjectSectionsList, subjectSectionsListSchema, "Sections inside a test subject."),
  "subscription/history": read(subscriptionHistory, subscriptionHistorySchema, "Your subscription payment history."),
  "subscription/mandate/status": read(subscriptionMandateStatus, subscriptionMandateStatusSchema, "Status of your autopay mandate."),
  "subscription/payment-info": read(subscriptionPaymentInfo, subscriptionPaymentInfoSchema, "Payment details for your subscription."),
  "subscription/plans": read(subscriptionPlans, subscriptionPlansSchema, "Subscription plans you can buy."),
  "subscription/status": read(subscriptionStatus, subscriptionStatusSchema, "Your current subscription."),
  "support/thread/messages": read(supportThreadMessages, supportThreadMessagesSchema, "Messages in one support thread."),
  "support/threads": read(supportThreads, supportThreadsSchema, "Your support threads with the Testkart team."),
  "team/list": read(teamList, teamListSchema, "Your team members."),
  "test-item-subjects/list": read(testItemSubjectsList, testItemSubjectsListSchema, "Subjects inside a test item."),
  "test-items/list": read(testItemsList, testItemsListSchema, "Test items (the individual papers) inside a test series."),
  "tests/list": read(testsList, testsListSchema, "Your test series."),
  "trash/list": read(trashList, trashListSchema, "Deleted test series and test items that can still be restored."),
  "withdrawal/list": read(withdrawalList, withdrawalListSchema, "Your withdrawal requests."),
  "work-experiences/list": read(workExperiencesList, workExperiencesListSchema, "Work experience entries on your public profile."),

  "academy/update": write(academyUpdate, academyUpdateSchema, "Update your academy details."),
  "ai/generate-all": write(aiGenerateAll, aiGenerateAllSchema, "AI: draft a title, descriptions, tags and price for new content from a prompt. Saves nothing."),
  "ai/generate-distractors": write(aiGenerateDistractors, aiGenerateDistractorsSchema, "AI: suggest wrong answer options for a question. Saves nothing."),
  "ai/generate-list": write(aiGenerateList, aiGenerateListSchema, "AI: suggest list items for a content field. Saves nothing."),
  "ai/rewrite": write(aiRewrite, aiRewriteSchema, "AI: rewrite a piece of text. Saves nothing."),
  "bank-details/add": write(bankDetailsAdd, bankDetailsAddSchema, "Save or replace the bank account, UPI and PAN details payouts go to.", CONFIRM),
  "bundles/create": write(bundlesCreate, bundlesCreateSchema, "Create a bundle."),
  "bundles/delete": write(bundlesDelete, bundlesDeleteSchema, "Delete a bundle.", CONFIRM),
  "bundles/publish": write(bundlesPublish, bundlesPublishSchema, "Publish or unpublish a bundle."),
  "bundles/update": write(bundlesUpdate, bundlesUpdateSchema, "Update a bundle."),
  "course-lessons/create": write(courseLessonsCreate, courseLessonsCreateSchema, "Add a lesson to a course section."),
  "course-lessons/delete": write(courseLessonsDelete, courseLessonsDeleteSchema, "Delete a course lesson.", CONFIRM),
  "course-lessons/reorder": write(courseLessonsReorder, courseLessonsReorderSchema, "Reorder lessons in a course section."),
  "course-lessons/update": write(courseLessonsUpdate, courseLessonsUpdateSchema, "Update a course lesson."),
  "course-sections/create": write(courseSectionsCreate, courseSectionsCreateSchema, "Add a section to a course."),
  "course-sections/delete": write(courseSectionsDelete, courseSectionsDeleteSchema, "Delete a course section and its lessons.", CONFIRM),
  "course-sections/reorder": write(courseSectionsReorder, courseSectionsReorderSchema, "Reorder sections in a course."),
  "course-sections/update": write(courseSectionsUpdate, courseSectionsUpdateSchema, "Update a course section."),
  "courses/create": write(coursesCreate, coursesCreateSchema, "Create a course."),
  "courses/delete": write(coursesDelete, coursesDeleteSchema, "Delete a course.", CONFIRM),
  "courses/publish": write(coursesPublish, coursesPublishSchema, "Publish a course. It goes live immediately."),
  "courses/unpublish": write(coursesUnpublish, coursesUnpublishSchema, "Take a course off sale.", CONFIRM),
  "courses/update": write(coursesUpdate, coursesUpdateSchema, "Update a course. Only the fields sent are changed."),
  "editor-images/upload": write(editorImagesUpload, editorImagesUploadSchema, "Upload an image for rich text such as question text, from a public https link or base64. Returns the url for an <img> tag."),
  "editor-images/upload-url": write(editorImagesUploadUrl, editorImagesUploadUrlSchema, "Get a 15-minute link to PUT one image file to, for clients that can run code with internet access. Use the returned url only after the PUT succeeds."),
  inquiry: write(inquiry, inquirySchema, "Send an inquiry to the Testkart team."),
  "live-test/publish": write(liveTestPublish, liveTestPublishSchema, "Publish a live test by liveTestId. It goes live immediately."),
  "live-tests/create": write(liveTestsCreate, liveTestsCreateSchema, "Create a live test."),
  "live-tests/delete": write(liveTestsDelete, liveTestsDeleteSchema, "Delete a live test.", CONFIRM),
  "live-tests/duplicate": write(liveTestsDuplicate, liveTestsDuplicateSchema, "Duplicate a live test."),
  "live-tests/publish": write(liveTestsPublish, liveTestsPublishSchema, "Publish a live test. It goes live immediately."),
  "live-tests/unpublish": write(liveTestsUnpublish, liveTestsUnpublishSchema, "Take a live test off the site.", CONFIRM),
  "live-tests/update": write(liveTestsUpdate, liveTestsUpdateSchema, "Update a live test."),
  "onboarding/complete": write(onboardingComplete, onboardingCompleteSchema, "Complete teacher onboarding."),
  "products/analyze-pdf": write(productsAnalyzePdf, productsAnalyzePdfSchema, "AI: suggest category, tags and exam from text taken from a PDF. Saves nothing."),
  "products/bulk": write(productsBulk, productsBulkSchema, "Publish, unpublish or archive several study notes at once.", CONFIRM),
  "products/create": write(productsCreate, productsCreateSchema, "Create study notes from PDF files already at https URLs."),
  "products/delete": write(productsDelete, productsDeleteSchema, "Delete study notes.", CONFIRM),
  "products/pdf-page-count": write(productsPdfPageCount, productsPdfPageCountSchema, "Count the pages of a PDF at a URL and preview its text. Saves nothing."),
  "products/publish": write(productsPublish, productsPublishSchema, "Publish study notes. They go live immediately."),
  "products/unpublish": write(productsUnpublish, productsUnpublishSchema, "Take study notes off sale.", CONFIRM),
  "products/update": write(productsUpdate, productsUpdateSchema, "Update study notes."),
  "profile/update": write(profileUpdate, profileUpdateSchema, "Update your public teacher profile."),
  "promo-codes/delete": write(promoCodesDelete, promoCodesDeleteSchema, "Delete a promo code.", CONFIRM),
  "question-bank/bulk-upload": write(questionBankBulkUpload, questionBankBulkUploadSchema, "Add many questions to your question bank at once."),
  "question-bank/create": write(questionBankCreate, questionBankCreateSchema, "Add a question to your question bank."),
  "question-bank/delete": write(questionBankDelete, questionBankDeleteSchema, "Delete question bank questions.", CONFIRM),
  "question-bank/import-to-test": write(questionBankImportToTest, questionBankImportToTestSchema, "Copy question bank questions into a test subject."),
  "question-bank/save-from-test": write(questionBankSaveFromTest, questionBankSaveFromTestSchema, "Save questions from a test into your question bank."),
  "question-bank/update": write(questionBankUpdate, questionBankUpdateSchema, "Update a question bank question."),
  "questions/accept-ai": write(questionsAcceptAi, questionsAcceptAiSchema, "Save AI question drafts from questions/generate-ai into a subject (at most 20).", { plainJson: true }),
  "questions/assign-sections": write(questionsAssignSections, questionsAssignSectionsSchema, "Assign questions to sections within a subject."),
  "questions/bulk-update-marks": write(questionsBulkUpdateMarks, questionsBulkUpdateMarksSchema, "Set marks on many questions at once."),
  "questions/bulk-update-timing": write(questionsBulkUpdateTiming, questionsBulkUpdateTimingSchema, "Set time limits on many questions at once."),
  "questions/bulk-upload": write(questionsBulkUpload, questionsBulkUploadSchema, "Add many questions to a test subject at once."),
  "questions/create": write(questionsCreate, questionsCreateSchema, "Add a question to a test subject."),
  "questions/delete": write(questionsDelete, questionsDeleteSchema, "Delete a question.", CONFIRM),
  "questions/generate-ai": write(questionsGenerateAi, questionsGenerateAiSchema, "AI: draft up to 20 questions for a subject. Saves nothing - pass the drafts the teacher keeps to questions/accept-ai.", { plainJson: true }),
  "questions/reorder": write(questionsReorder, questionsReorderSchema, "Reorder questions."),
  "questions/update": write(questionsUpdate, questionsUpdateSchema, "Update a question."),
  "sponsor-student/check": write(sponsorStudentCheck, sponsorStudentCheckSchema, "Look up a student and the cost of sponsoring them into your content. Changes nothing."),
  "sponsor-student/enroll": write(sponsorStudentEnroll, sponsorStudentEnrollSchema, "Sponsor a student into your content, paid from your balance or online. Can create the student's account.", CONFIRM),
  "subject-sections/create": write(subjectSectionsCreate, subjectSectionsCreateSchema, "Add a section to a test subject."),
  "subject-sections/delete": write(subjectSectionsDelete, subjectSectionsDeleteSchema, "Delete a test subject section.", CONFIRM),
  "subject-sections/reorder": write(subjectSectionsReorder, subjectSectionsReorderSchema, "Reorder sections in a test subject."),
  "subject-sections/update": write(subjectSectionsUpdate, subjectSectionsUpdateSchema, "Update a test subject section."),
  "subscription/subscribe": write(subscriptionSubscribe, subscriptionSubscribeSchema, "Subscribe to a plan.", CONFIRM),
  "subscription/wallet-subscribe": write(subscriptionWalletSubscribe, subscriptionWalletSubscribeSchema, "Subscribe to a plan using your wallet balance, with any remainder paid online.", CONFIRM),
  "support/thread/create": write(supportThreadCreate, supportThreadCreateSchema, "Open a support thread with the Testkart team."),
  "support/thread/reply": write(supportThreadReply, supportThreadReplySchema, "Reply in a support thread."),
  "team/invite": write(teamInvite, teamInviteSchema, "Invite a team manager by name and 10-digit phone number.", CONFIRM),
  "team/remove": write(teamRemove, teamRemoveSchema, "Remove a team member.", CONFIRM),
  "test-item-subjects/bulk-create": write(testItemSubjectsBulkCreate, testItemSubjectsBulkCreateSchema, "Add several subjects to a test item."),
  "test-item-subjects/create": write(testItemSubjectsCreate, testItemSubjectsCreateSchema, "Add a subject to a test item."),
  "test-item-subjects/delete": write(testItemSubjectsDelete, testItemSubjectsDeleteSchema, "Delete a test item subject and its questions.", CONFIRM),
  "test-item-subjects/reorder": write(testItemSubjectsReorder, testItemSubjectsReorderSchema, "Reorder subjects in a test item."),
  "test-item-subjects/update": write(testItemSubjectsUpdate, testItemSubjectsUpdateSchema, "Update a test item subject."),
  "test-items/bulk-create": write(testItemsBulkCreate, testItemsBulkCreateSchema, "Add up to 50 empty test items to a test series."),
  "test-items/create": write(testItemsCreate, testItemsCreateSchema, "Add a test item (paper) to a test series."),
  "test-items/delete": write(testItemsDelete, testItemsDeleteSchema, "Delete a test item.", CONFIRM),
  "test-items/reorder": write(testItemsReorder, testItemsReorderSchema, "Reorder test items in a test series."),
  "test-items/update": write(testItemsUpdate, testItemsUpdateSchema, "Update a test item."),
  "tests/create": write(testsCreate, testsCreateSchema, "Create a test series."),
  "tests/create-with-items": write(testsCreateWithItems, testsCreateWithItemsSchema, "Create a test series together with up to 50 empty test items."),
  "tests/delete": write(testsDelete, testsDeleteSchema, "Delete a test series.", CONFIRM),
  "tests/publish": write(testsPublish, testsPublishSchema, "Publish a test series. It goes live immediately."),
  "tests/unpublish": write(testsUnpublish, testsUnpublishSchema, "Take a test series off sale.", CONFIRM),
  "tests/update": write(testsUpdate, testsUpdateSchema, "Update a test series."),
  "trash/delete": write(trashDelete, trashDeleteSchema, "Permanently delete a trashed test series or test item. Cannot be undone.", CONFIRM),
  "trash/restore": write(trashRestore, trashRestoreSchema, "Restore a trashed test series or test item."),
  "withdrawal/request": write(withdrawalRequest, withdrawalRequestSchema, "Request a withdrawal of your available earnings.", CONFIRM),
  "work-experiences/create": write(workExperiencesCreate, workExperiencesCreateSchema, "Add a work experience entry to your profile."),
  "work-experiences/delete": write(workExperiencesDelete, workExperiencesDeleteSchema, "Delete a work experience entry.", CONFIRM),
  "work-experiences/update": write(workExperiencesUpdate, workExperiencesUpdateSchema, "Update a work experience entry."),
};

/** Teacher endpoints the connector refuses, with the reason given to the model. */
export const BLOCKED_ACTIONS: Readonly<Record<string, string>> = {
  "subscription/cancel":
    "Cancelling a subscription is only available on the Testkart website.",
  "subscription/mandate/cancel":
    "Cancelling the autopay mandate is only available on the Testkart website.",
  "promo-codes/create":
    "Promo codes discount sales, so they are only created on the Testkart website.",
  "promo-codes/update":
    "Promo codes discount sales, so they are only changed on the Testkart website.",
  "test-item/download-pdf":
    "This returns a PDF file, which the connector cannot carry. Download it from the teacher console.",
};

const SESSION_TTL = "5m";

function lookup(action: string, kind?: TeacherActionKind): TeacherAction {
  if (Object.prototype.hasOwnProperty.call(BLOCKED_ACTIONS, action)) {
    throw new McpTeacherToolError(
      `Refused: ${action} is not available through this connector. ${BLOCKED_ACTIONS[action]}`
    );
  }
  if (!Object.prototype.hasOwnProperty.call(ACTIONS, action)) {
    throw new McpTeacherToolError(`Unknown action "${action}". Call teacher_actions to list them.`);
  }
  const definition = ACTIONS[action];
  if (kind && definition.kind !== kind) {
    throw new McpTeacherToolError(`${action} is a ${definition.kind} action; use teacher_${definition.kind}.`);
  }
  return definition;
}

export function teacherActionNames(kind: TeacherActionKind): string[] {
  return Object.keys(ACTIONS)
    .filter((action) => ACTIONS[action].kind === kind)
    .sort();
}

export function listTeacherActions(kind?: TeacherActionKind) {
  const actions = Object.entries(ACTIONS)
    .filter(([, definition]) => !kind || definition.kind === kind)
    .map(([action, definition]) => ({
      action,
      kind: definition.kind,
      summary: definition.summary,
      ...(definition.confirm ? { requiresConfirm: true } : {}),
    }))
    .sort((a, b) => a.action.localeCompare(b.action));
  return { actions, unavailable: BLOCKED_ACTIONS };
}

function toJsonSchema(schema: ZodTypeAny | null): Record<string, unknown> {
  if (!schema) return { type: "object", properties: {} };
  const converted = zodToJsonSchema(schema, {
    $refStrategy: "none",
    dateStrategy: "format:date-time",
    effectStrategy: "input",
  }) as Record<string, unknown>;
  delete converted.$schema;
  return converted;
}

export function describeTeacherAction(action: string) {
  const definition = lookup(action);
  return {
    action,
    kind: definition.kind,
    summary: definition.summary,
    requiresConfirm: definition.confirm,
    input:
      definition.kind === "read"
        ? "Pass these as teacher_read query parameters."
        : "Pass this as the teacher_write body. Dates are ISO 8601 strings.",
    schema: toJsonSchema(definition.schema),
  };
}

type ZodDefLike = {
  typeName?: string;
  innerType?: ZodTypeAny;
  schema?: ZodTypeAny;
  in?: ZodTypeAny;
  type?: ZodTypeAny;
  valueType?: ZodTypeAny;
  left?: ZodTypeAny;
  right?: ZodTypeAny;
  options?: ZodTypeAny[] | Map<unknown, ZodTypeAny>;
  shape?: () => Record<string, ZodTypeAny>;
  getter?: () => ZodTypeAny;
};

/**
 * MCP arguments are plain JSON, but some endpoint schemas expect Date objects. Walk the endpoint's
 * zod schema and turn date strings into Dates wherever it asks for one, so superjson carries them.
 */
function reviveDates(schema: ZodTypeAny | null | undefined, value: unknown): unknown {
  if (!schema || value === null || value === undefined) return value;
  const def = schema._def as ZodDefLike;

  switch (def.typeName) {
    case "ZodDate":
      return typeof value === "string" || typeof value === "number" ? new Date(value) : value;
    case "ZodOptional":
    case "ZodNullable":
    case "ZodDefault":
    case "ZodCatch":
    case "ZodReadonly":
    case "ZodBranded":
      return reviveDates(def.innerType ?? def.type, value);
    case "ZodEffects":
      return reviveDates(def.schema, value);
    case "ZodPipeline":
      return reviveDates(def.in, value);
    case "ZodLazy":
      return def.getter ? reviveDates(def.getter(), value) : value;
    case "ZodArray":
      return Array.isArray(value) ? value.map((item) => reviveDates(def.type, item)) : value;
    case "ZodObject": {
      if (typeof value !== "object" || Array.isArray(value) || !def.shape) return value;
      const shape = def.shape();
      const next: Record<string, unknown> = { ...(value as Record<string, unknown>) };
      for (const key of Object.keys(shape)) {
        if (key in next) next[key] = reviveDates(shape[key], next[key]);
      }
      return next;
    }
    case "ZodRecord": {
      if (typeof value !== "object" || Array.isArray(value)) return value;
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, item]) => [
          key,
          reviveDates(def.valueType, item),
        ])
      );
    }
    case "ZodIntersection":
      return reviveDates(def.right, reviveDates(def.left, value));
    case "ZodUnion":
    case "ZodDiscriminatedUnion": {
      const options = Array.isArray(def.options)
        ? def.options
        : def.options
          ? Array.from(def.options.values())
          : [];
      for (const option of options) {
        const candidate = reviveDates(option, value);
        if (option.safeParse(candidate).success) return candidate;
      }
      return value;
    }
    default:
      return value;
  }
}

async function buildRequest(
  access: TeacherAccess,
  path: string,
  init: { method: "GET" | "POST"; body?: string }
): Promise<Request> {
  const now = Date.now();
  const token = await createServerSessionToken(
    { id: access.sessionId, createdAt: now, lastAccessed: now },
    SESSION_TTL
  );
  return new Request(`${SITE_ORIGIN}/_api/teacher/${path}`, {
    method: init.method,
    headers: {
      authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    ...(init.body === undefined ? {} : { body: init.body }),
  });
}

async function run(handler: EndpointHandler, request: Request, action: string): Promise<unknown> {
  const response = await handler(request);
  const payload = unwrapEndpointPayload(await response.text());
  if (!response.ok) {
    throw new McpTeacherToolError(
      `${action} failed (${response.status}): ${extractEndpointError(payload) ?? "unknown error"}`
    );
  }
  return payload;
}

export async function describeTeacherAccount(access: TeacherAccess) {
  const session = await getServerUserSession(await buildRequest(access, "whoami", { method: "GET" }));
  if (session.user.role !== "teacher") {
    throw new McpTeacherToolError("This account is no longer a teacher account. Remove the connector.");
  }
  return {
    teacher: {
      id: session.user.id,
      displayName: session.user.displayName,
      email: session.user.email,
      mobileNumber: session.user.mobileNumber ?? null,
    },
    teamRole: session.teacherRole ?? "owner",
    actingAsTeacherId: session.effectiveTeacherId,
    impersonatedByAdmin: session.impersonatorAdminId != null,
    unavailable: BLOCKED_ACTIONS,
  };
}

export async function callTeacherRead(
  access: TeacherAccess,
  action: string,
  query?: Record<string, unknown>
): Promise<unknown> {
  const definition = lookup(action, "read");
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null) search.append(key, String(value));
  }
  const suffix = search.toString() ? `?${search.toString()}` : "";
  const request = await buildRequest(access, `${action}${suffix}`, { method: "GET" });
  return run(definition.handler, request, action);
}

export async function callTeacherWrite(
  access: TeacherAccess,
  action: string,
  body: Record<string, unknown> | undefined,
  confirm: boolean
): Promise<unknown> {
  const definition = lookup(action, "write");
  if (definition.confirm && !confirm) {
    throw new McpTeacherToolError(
      `Refused: ${action} needs confirmation. Show the teacher exactly what will happen - the ` +
        "record, amount or plan - then call again with confirm: true once they approve."
    );
  }
  const payload = body ?? {};
  const encoded = definition.plainJson
    ? JSON.stringify(payload)
    : superjson.stringify(reviveDates(definition.schema, payload));
  const request = await buildRequest(access, action, { method: "POST", body: encoded });
  return run(definition.handler, request, action);
}
