/**
 * Which email_templates rows are actually consulted at send time.
 *
 * The table holds 49 rows, but only some of them are read by the code that
 * sends the mail. The rest are sent from hardcoded functions in
 * helpers/emailTemplates.tsx and helpers/emailTemplatesExtra.tsx, which means
 * editing them in the admin screen changes nothing.
 *
 * This map is derived from a code audit, not from the database. Update it
 * whenever a send path moves between sendTemplateEmail and a hardcoded helper.
 */

export type EmailTemplateWiringStatus = "live" | "hardcoded" | "no-trigger";

export type EmailTemplateWiring = {
  status: EmailTemplateWiringStatus;
  /** Where the mail is actually sent from, or why it is never sent. */
  source: string;
};

export const EMAIL_TEMPLATE_WIRING: Record<string, EmailTemplateWiring> = {
  // Read from the database at send time - admin edits take effect.
  account_closure_confirmation: { status: "live", source: "endpoints/account/close-request_POST" },
  account_reactivated: { status: "live", source: "endpoints/admin/user/toggle-status_POST" },
  account_suspended: { status: "live", source: "endpoints/admin/user/toggle-status_POST" },
  bank_details_rejected: { status: "live", source: "endpoints/admin/bank-details/verify_POST" },
  bank_details_verified: { status: "live", source: "endpoints/admin/bank-details/verify_POST" },
  contact_form_acknowledgment: { status: "live", source: "endpoints/contact/submit_POST" },
  contact_form_admin_alert: { status: "live", source: "endpoints/contact/submit_POST, endpoints/demo-request/submit_POST" },
  content_review_approved: { status: "live", source: "endpoints/admin/content-reviews/review_POST, approve-all_POST" },
  content_review_rejected: { status: "live", source: "endpoints/admin/content-reviews/review_POST, approve-all_POST" },
  live_test_reminder: { status: "live", source: "helpers/sendLiveTestReminder (queued task, 1h before start)" },
  live_test_results: { status: "live", source: "helpers/liveTestPrizePayout" },
  promo_code_used: { status: "live", source: "helpers/sendOrderConfirmationEmails" },
  review_reminder: { status: "live", source: "helpers/sendReviewReminder (queued task, 24h after purchase)" },
  student_bank_details_rejected: { status: "live", source: "endpoints/admin/student-bank-details/verify_POST" },
  student_bank_details_verified: { status: "live", source: "endpoints/admin/student-bank-details/verify_POST" },
  student_withdrawal_requested: { status: "live", source: "endpoints/student/withdrawal/request_POST" },
  support_reply_to_admin: { status: "live", source: "endpoints/teacher/support/thread/reply_POST" },
  support_reply_to_teacher: { status: "live", source: "endpoints/admin/support/thread/reply_POST" },
  support_ticket_admin_notification: { status: "live", source: "endpoints/teacher/support/thread/create_POST" },
  verified_badge_granted: { status: "live", source: "endpoints/admin/user/toggle-verified_POST" },
  wallet_credit_received: { status: "live", source: "helpers/liveTestPrizePayout" },
  welcome_student: { status: "live", source: "endpoints/auth/register_student_POST, register_with_password_POST, helpers/sendOAuthWelcomeEmail" },
  welcome_teacher: { status: "live", source: "endpoints/auth/register_teacher_POST, helpers/sendOAuthWelcomeEmail" },

  // Sent from a hardcoded function - edits here are ignored.
  bundle_enrollment: { status: "hardcoded", source: "emailTemplatesExtra.bundleEnrollmentStudent" },
  course_enrollment: { status: "hardcoded", source: "emailTemplates.courseEnrollment" },
  digital_product_purchase: { status: "hardcoded", source: "emailTemplatesExtra.digitalProductPurchase" },
  free_course_enrollment: { status: "hardcoded", source: "emailTemplatesExtra.freeCourseEnrollment" },
  free_test_enrollment: { status: "hardcoded", source: "emailTemplatesExtra.freeTestEnrollment" },
  live_test_enrollment: { status: "hardcoded", source: "emailTemplatesExtra.liveTestEnrolled" },
  mandate_cancelled: { status: "hardcoded", source: "emailTemplates.mandateCancelled" },
  new_purchase_notification: { status: "hardcoded", source: "emailTemplatesExtra.newPurchaseNotification" },
  new_review_received: { status: "hardcoded", source: "emailTemplatesExtra.newReviewReceived" },
  new_student_enrolled: { status: "hardcoded", source: "emailTemplates.newStudentEnrolled" },
  order_confirmation: { status: "hardcoded", source: "emailTemplates.orderConfirmation" },
  payment_failed: { status: "hardcoded", source: "emailTemplatesExtra.paymentFailed" },
  sponsored_enrollment: { status: "hardcoded", source: "emailTemplates.sponsoredEnrollment" },
  subscription_activated: { status: "hardcoded", source: "emailTemplates.subscriptionActivated" },
  subscription_cancelled: { status: "hardcoded", source: "emailTemplates.subscriptionCancelled" },
  subscription_payment_failed: { status: "hardcoded", source: "emailTemplates.subscriptionPaymentFailed" },
  subscription_renewed: { status: "hardcoded", source: "emailTemplates.subscriptionRenewed" },
  subscription_upgraded: { status: "hardcoded", source: "emailTemplates.subscriptionUpgraded" },
  test_enrollment: { status: "hardcoded", source: "emailTemplates.testEnrollment" },
  withdrawal_processed: { status: "hardcoded", source: "emailTemplates.withdrawalProcessed" },
  withdrawal_requested: { status: "hardcoded", source: "emailTemplates.withdrawalRequested" },

  // No code path sends these at all.
  certificate_generated: { status: "no-trigger", source: "No certificate flow sends email" },
  content_submitted_for_review: { status: "no-trigger", source: "Publishing goes draft to published with no review step" },
  password_reset: { status: "no-trigger", source: "Student and teacher login is OTP-based; the admin reset email is built in code" },
  payment_successful: { status: "no-trigger", source: "Superseded by order_confirmation; helper has no caller" },
  test_completed: { status: "no-trigger", source: "Test submission sends no email" },
};

export const getEmailTemplateWiring = (
  templateKey: string
): EmailTemplateWiring =>
  EMAIL_TEMPLATE_WIRING[templateKey] ?? {
    status: "no-trigger",
    source: "Not referenced anywhere in the codebase",
  };

export const WIRING_LABELS: Record<
  EmailTemplateWiringStatus,
  { label: string; description: string }
> = {
  live: {
    label: "Live",
    description: "Read from this table when the email is sent. Your edits go out to users.",
  },
  hardcoded: {
    label: "Not wired",
    description:
      "This email is sent, but its content comes from a hardcoded helper in the codebase. Editing it here has no effect.",
  },
  "no-trigger": {
    label: "Never sent",
    description:
      "No code path sends this email. The row is a placeholder for a flow that does not exist yet.",
  },
};

/**
 * Emails that bypass this table entirely. They are composed inline with
 * helpers/emailBaseTemplate and sent straight through helpers/sendEmail, so
 * they have no row here and cannot be edited from the admin screen.
 */
export const UNMANAGED_EMAILS: { name: string; source: string }[] = [
  { name: "Login OTP", source: "endpoints/auth/email-login/send-otp_POST" },
  { name: "Signup OTP", source: "endpoints/auth/email-signup/send-otp_POST" },
  { name: "Email verification OTP", source: "endpoints/auth/send-email-otp_POST" },
  { name: "Admin password reset", source: "endpoints/admin/password-reset/request_POST" },
];
