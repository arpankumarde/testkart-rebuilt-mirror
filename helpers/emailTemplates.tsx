import { format } from "date-fns";
import { getBrandedEmailHtml } from "./emailBaseTemplate";

// --- Types ---

export type OrderDetails = {
  orderId: number | string;
  totalAmount: number;
  items: {
    title: string;
    price: number;
    type: "course" | "test" | "bundle" | "digital_product";
  }[];
  date: Date;
};

export type EmailTemplateResult = {
  subject: string;
  html: string;
  text: string;
};

// --- Templates ---

export const welcomeStudent = (
  displayName: string,
  email: string
): EmailTemplateResult => {
  const subject = "Welcome to Testkart! 🚀";
  const html = getBrandedEmailHtml({
    title: subject,
    icon: "👋",
    heading: `Welcome aboard, ${displayName}!`,
    subheading: "We're thrilled to have you join the Testkart family.",
    bodyHtml: `
      <p style="margin:0 0 16px;">You've successfully created your student account. Get ready to explore thousands of mock tests, courses, and study materials to ace your exams.</p>
      <p style="margin:0;"><strong>Here's what you can do next:</strong></p>
      <ul style="margin:12px 0 0;padding-left:20px;line-height:1.8;">
        <li>Browse popular exams and test series</li>
        <li>Enroll in courses from top educators</li>
        <li>Track your progress and improve your scores</li>
      </ul>
    `,
    ctaLabel: "Go to Dashboard",
    ctaUrl: "https://testkart.in/student/dashboard",
  });

  return {
    subject,
    html,
    text: `Welcome to Testkart, ${displayName}! We're thrilled to have you on board. Visit your dashboard to get started: https://testkart.in/student/dashboard`,
  };
};

export const welcomeTeacher = (
  displayName: string,
  email: string
): EmailTemplateResult => {
  const subject = "Welcome to Testkart for Teachers! 🎓";
  const html = getBrandedEmailHtml({
    title: subject,
    icon: "🎓",
    heading: `Welcome, ${displayName}!`,
    subheading: "You've joined the Testkart teaching community.",
    bodyHtml: `
      <p style="margin:0 0 16px;">You've taken the first step towards reaching thousands of students and monetizing your expertise. Our platform gives you all the tools you need to create, sell, and manage your educational content.</p>
      <p style="margin:0;"><strong>To get started:</strong></p>
      <ol style="margin:12px 0 0;padding-left:20px;line-height:1.8;">
        <li>Complete your profile</li>
        <li>Create your first mock test or course</li>
        <li>Publish and start earning</li>
      </ol>
    `,
    ctaLabel: "Go to Teacher Dashboard",
    ctaUrl: "https://testkart.in/teacher/dashboard",
  });

  return {
    subject,
    html,
    text: `Welcome to Testkart, ${displayName}! Start creating your content today at https://testkart.in/teacher/dashboard`,
  };
};

export const orderConfirmation = (
  orderDetails: OrderDetails
): EmailTemplateResult => {
  const subject = `Order Confirmation #${orderDetails.orderId}`;

  const html = getBrandedEmailHtml({
    title: subject,
    icon: "🎉",
    heading: "Thank you for your purchase!",
    subheading: `Order #${orderDetails.orderId} · ${format(orderDetails.date, "PPP")}`,
    table: [
      ...orderDetails.items.map((item) => ({
        label: `${item.title} (${item.type})`,
        value: `₹${item.price.toFixed(2)}`,
      })),
      { label: "Total", value: `₹${orderDetails.totalAmount.toFixed(2)}`, emphasize: true },
    ],
    bodyHtml: `<p style="margin:0;">You can access your purchased items immediately from your dashboard.</p>`,
    ctaLabel: "Access My Content",
    ctaUrl: "https://testkart.in/student/dashboard",
  });

  return {
    subject,
    html,
    text: `Thank you for your purchase! Order #${orderDetails.orderId} for ₹${orderDetails.totalAmount} has been confirmed. Access your content at https://testkart.in/student/dashboard`,
  };
};

export const testEnrollment = (
  studentName: string,
  testName: string,
  teacherName: string
): EmailTemplateResult => {
  const subject = `Enrolled: ${testName}`;
  const html = getBrandedEmailHtml({
    title: subject,
    icon: "📚",
    heading: "Enrollment Successful!",
    subheading: `Hi ${studentName}`,
    bodyHtml: `<p style="margin:0;">You have successfully enrolled in the test series <strong>"${testName}"</strong> by ${teacherName}. Get ready to practice and improve your skills!</p>`,
    ctaLabel: "Start Practicing",
    ctaUrl: "https://testkart.in/student/tests",
  });

  return {
    subject,
    html,
    text: `Hi ${studentName}, you have successfully enrolled in "${testName}" by ${teacherName}. Start practicing now at https://testkart.in/student/tests`,
  };
};

export const courseEnrollment = (
  studentName: string,
  courseName: string,
  teacherName: string
): EmailTemplateResult => {
  const subject = `Enrolled: ${courseName}`;
  const html = getBrandedEmailHtml({
    title: subject,
    icon: "🎬",
    heading: "Course Enrollment Successful!",
    subheading: `Hi ${studentName}`,
    bodyHtml: `<p style="margin:0;">You are now enrolled in the course <strong>"${courseName}"</strong> by ${teacherName}. Start learning today!</p>`,
    ctaLabel: "Go to Course",
    ctaUrl: "https://testkart.in/student/courses",
  });

  return {
    subject,
    html,
    text: `Hi ${studentName}, you are now enrolled in "${courseName}" by ${teacherName}. Start learning at https://testkart.in/student/courses`,
  };
};

export const bundleEnrollment = (
  studentName: string,
  bundleName: string,
  teacherName: string
): EmailTemplateResult => {
  const subject = `Bundle Enrolled: ${bundleName}`;
  const html = getBrandedEmailHtml({
    title: subject,
    icon: "📦",
    heading: "Bundle Unlocked!",
    subheading: `Hi ${studentName}`,
    bodyHtml: `<p style="margin:0;">You have successfully purchased the bundle <strong>"${bundleName}"</strong> by ${teacherName}. All the courses and tests included in this bundle have been added to your account.</p>`,
    ctaLabel: "View My Dashboard",
    ctaUrl: "https://testkart.in/student/dashboard",
  });

  return {
    subject,
    html,
    text: `Hi ${studentName}, you have successfully purchased the bundle "${bundleName}". Access your content at https://testkart.in/student/dashboard`,
  };
};

export const liveTestEnrollment = (
  studentName: string,
  testName: string,
  scheduledDate: Date
): EmailTemplateResult => {
  const subject = `Registration Confirmed: ${testName}`;
  const formattedDate = format(scheduledDate, "PPP p");
  const html = getBrandedEmailHtml({
    title: subject,
    icon: "🎯",
    heading: "Live Test Registration Confirmed",
    subheading: `Hi ${studentName}`,
    bodyHtml: `<p style="margin:0;">You are registered for the live test <strong>"${testName}"</strong>. Please make sure to log in 10 minutes before the start time.</p>`,
    table: [{ label: "Scheduled Time", value: formattedDate, emphasize: true }],
    ctaLabel: "View Live Tests",
    ctaUrl: "https://testkart.in/mock-test/live",
  });

  return {
    subject,
    html,
    text: `Hi ${studentName}, you are registered for "${testName}" scheduled at ${formattedDate}. Please log in early.`,
  };
};

export const paymentSuccessful = (
  orderDetails: OrderDetails
): EmailTemplateResult => {
  const subject = `Payment Receipt for Order #${orderDetails.orderId}`;
  const html = getBrandedEmailHtml({
    title: subject,
    icon: "💳",
    accent: "success",
    heading: "Payment Successful",
    bodyHtml: `<p style="margin:0;">We have received your payment for Order #${orderDetails.orderId}. Thank you for choosing Testkart.</p>`,
    table: [{ label: "Amount Paid", value: `₹${orderDetails.totalAmount.toFixed(2)}`, emphasize: true }],
  });

  return {
    subject,
    html,
    text: `Payment of ₹${orderDetails.totalAmount} for Order #${orderDetails.orderId} was successful.`,
  };
};

export const passwordReset = (resetLink: string): EmailTemplateResult => {
  const subject = "Reset Your Password";
  const html = getBrandedEmailHtml({
    title: subject,
    icon: "🔐",
    heading: "Password Reset Request",
    subheading: "We've got you covered.",
    bodyHtml: `
      <p style="margin:0 0 12px;">We received a request to reset your password for your Testkart account. Click the button below to reset it. This link will expire in 1 hour.</p>
      <p style="margin:0;font-size:13px;color:#676F7E;font-style:italic;">If you didn't ask to reset your password, you can safely ignore this email.</p>
    `,
    ctaLabel: "Reset Password",
    ctaUrl: resetLink,
  });

  return {
    subject,
    html,
    text: `Reset your password by visiting this link: ${resetLink}`,
  };
};

export const withdrawalRequested = (
  teacherName: string,
  amount: number
): EmailTemplateResult => {
  const subject = "Withdrawal Request Received";
  const html = getBrandedEmailHtml({
    title: subject,
    icon: "💰",
    heading: "Withdrawal Request Received",
    subheading: `Hi ${teacherName}`,
    bodyHtml: `<p style="margin:0;">We have received your request to withdraw <strong>₹${amount.toFixed(2)}</strong>. Our team will process this request within 2-3 business days.</p>`,
  });

  return {
    subject,
    html,
    text: `Hi ${teacherName}, we received your withdrawal request for ₹${amount}. It will be processed in 2-3 business days.`,
  };
};

export const withdrawalProcessed = (
  teacherName: string,
  amount: number,
  status: "completed" | "failed" | "cancelled" | "pending"
): EmailTemplateResult => {
  const subject = `Withdrawal Update: ${status.toUpperCase()}`;
  const html = getBrandedEmailHtml({
    title: subject,
    icon: status === "completed" ? "✅" : status === "failed" ? "⚠️" : "💰",
    accent: status === "completed" ? "success" : status === "failed" ? "danger" : "brand",
    heading: status === "completed" ? "Withdrawal Successful" : "Withdrawal Update",
    subheading: `Hi ${teacherName}`,
    bodyHtml: `
      <p style="margin:0;">Your withdrawal request for <strong>₹${amount.toFixed(2)}</strong> has been marked as <strong>${status}</strong>.</p>
      <p style="margin:12px 0 0;">${
        status === "completed"
          ? "The funds should reflect in your bank account shortly."
          : "Please check your dashboard for more details or contact support if you have questions."
      }</p>
    `,
  });

  return {
    subject,
    html,
    text: `Hi ${teacherName}, your withdrawal for ₹${amount} is now ${status}.`,
  };
};

export const sponsoredEnrollment = (
  studentName: string,
  itemName: string,
  sponsorName: string
): EmailTemplateResult => {
  const subject = `You've been enrolled in ${itemName}`;
  const html = getBrandedEmailHtml({
    title: subject,
    icon: "🎁",
    heading: "Congratulations!",
    subheading: `Hi ${studentName}`,
    bodyHtml: `<p style="margin:0;"><strong>${sponsorName}</strong> has enrolled you in <strong>"${itemName}"</strong>. You can access this content immediately from your dashboard.</p>`,
    ctaLabel: "Go to Dashboard",
    ctaUrl: "https://testkart.in/student/dashboard",
  });

  return {
    subject,
    html,
    text: `Hi ${studentName}, ${sponsorName} has enrolled you in "${itemName}". Access it at https://testkart.in/student/dashboard`,
  };
};

export const newStudentEnrolled = (
  teacherName: string,
  studentName: string,
  itemName: string
): EmailTemplateResult => {
  const subject = `New Enrollment: ${itemName}`;
  const html = getBrandedEmailHtml({
    title: subject,
    icon: "🎓",
    accent: "success",
    heading: "New Student Enrollment!",
    subheading: `Hi ${teacherName}`,
    bodyHtml: `<p style="margin:0;">Good news! <strong>${studentName}</strong> has just enrolled in your <strong>"${itemName}"</strong>. Keep up the great work!</p>`,
    ctaLabel: "View Dashboard",
    ctaUrl: "https://testkart.in/teacher/dashboard",
  });

  return {
    subject,
    html,
    text: `Hi ${teacherName}, ${studentName} has enrolled in "${itemName}".`,
  };
};

export const subscriptionActivated = (
  teacherName: string,
  planName: string,
  amount: number,
  startDate: Date,
  endDate: Date
): EmailTemplateResult => {
  const subject = `Subscription Activated: ${planName}`;
  const html = getBrandedEmailHtml({
    title: subject,
    icon: "✅",
    accent: "success",
    heading: "Subscription Activated!",
    subheading: `Hi ${teacherName}`,
    bodyHtml: `<p style="margin:0;">Congratulations! Your subscription to the <strong>${planName}</strong> plan has been successfully activated.</p>`,
    table: [
      { label: "Amount Paid", value: `₹${amount.toFixed(2)}`, emphasize: true },
      { label: "Start Date", value: format(startDate, "PPP") },
      { label: "End Date", value: format(endDate, "PPP") },
    ],
    ctaLabel: "Go to Dashboard",
    ctaUrl: "https://testkart.in/teacher/dashboard",
  });

  return {
    subject,
    html,
    text: `Hi ${teacherName}, your subscription to ${planName} is active from ${format(startDate, "PPP")} to ${format(endDate, "PPP")}. Amount paid: ₹${amount.toFixed(2)}.`,
  };
};

export const subscriptionUpgraded = (
  teacherName: string,
  oldPlanName: string,
  newPlanName: string,
  amount: number,
  startDate: Date,
  endDate: Date
): EmailTemplateResult => {
  const subject = `Subscription Upgraded to ${newPlanName}`;
  const html = getBrandedEmailHtml({
    title: subject,
    icon: "⬆️",
    accent: "success",
    heading: "Subscription Upgraded!",
    subheading: `Hi ${teacherName}`,
    bodyHtml: `<p style="margin:0;">Your subscription has been successfully upgraded from <strong>${oldPlanName}</strong> to <strong>${newPlanName}</strong>.</p>`,
    table: [
      { label: "Amount Paid", value: `₹${amount.toFixed(2)}`, emphasize: true },
      { label: "Start Date", value: format(startDate, "PPP") },
      { label: "End Date", value: format(endDate, "PPP") },
    ],
    ctaLabel: "Go to Dashboard",
    ctaUrl: "https://testkart.in/teacher/dashboard",
  });

  return {
    subject,
    html,
    text: `Hi ${teacherName}, your subscription was upgraded to ${newPlanName}. Amount paid: ₹${amount.toFixed(2)}. Valid from ${format(startDate, "PPP")} to ${format(endDate, "PPP")}.`,
  };
};

export const subscriptionRenewed = (
  teacherName: string,
  planName: string,
  amount: number,
  newEndDate: Date
): EmailTemplateResult => {
  const subject = `Subscription Renewed: ${planName}`;
  const html = getBrandedEmailHtml({
    title: subject,
    icon: "🔄",
    accent: "success",
    heading: "Subscription Auto-Renewed!",
    subheading: `Hi ${teacherName}`,
    bodyHtml: `<p style="margin:0;">Your subscription to the <strong>${planName}</strong> plan has been successfully renewed.</p>`,
    table: [
      { label: "Amount Charged", value: `₹${amount.toFixed(2)}`, emphasize: true },
      { label: "New End Date", value: format(newEndDate, "PPP") },
    ],
    ctaLabel: "Go to Dashboard",
    ctaUrl: "https://testkart.in/teacher/dashboard",
  });

  return {
    subject,
    html,
    text: `Hi ${teacherName}, your subscription to ${planName} has been renewed. Amount charged: ₹${amount.toFixed(2)}. New end date: ${format(newEndDate, "PPP")}.`,
  };
};

export const subscriptionCancelled = (
  teacherName: string,
  planName: string,
  endDate: Date
): EmailTemplateResult => {
  const subject = `Subscription Cancelled: ${planName}`;
  const html = getBrandedEmailHtml({
    title: subject,
    icon: "👋",
    accent: "warning",
    heading: "Subscription Cancelled",
    subheading: `Hi ${teacherName}`,
    bodyHtml: `<p style="margin:0;">We've processed your request to cancel your <strong>${planName}</strong> subscription. You will continue to have access to all your subscription benefits until <strong>${format(endDate, "PPP")}</strong>.</p>`,
    ctaLabel: "Resubscribe",
    ctaUrl: "https://testkart.in/teacher/subscription",
  });

  return {
    subject,
    html,
    text: `Hi ${teacherName}, your subscription to ${planName} was cancelled. You have access until ${format(endDate, "PPP")}.`,
  };
};

export const subscriptionPaymentFailed = (
  teacherName: string,
  planName: string,
  amount: number
): EmailTemplateResult => {
  const subject = `Payment Failed: ${planName} Subscription`;
  const html = getBrandedEmailHtml({
    title: subject,
    icon: "⚠️",
    accent: "danger",
    heading: "Subscription Payment Failed",
    subheading: `Hi ${teacherName}`,
    bodyHtml: `<p style="margin:0;">We were unable to process your payment of <strong>₹${amount.toFixed(2)}</strong> for the <strong>${planName}</strong> subscription. Please update your payment method or try again to avoid any interruption in your service.</p>`,
    ctaLabel: "Retry Payment",
    ctaUrl: "https://testkart.in/teacher/subscription",
  });

  return {
    subject,
    html,
    text: `Hi ${teacherName}, your payment of ₹${amount.toFixed(2)} for ${planName} failed. Please retry to avoid interruption.`,
  };
};

export const mandateCancelled = (
  teacherName: string,
  planName: string
): EmailTemplateResult => {
  const subject = `Auto-Renewal Turned Off: ${planName}`;
  const html = getBrandedEmailHtml({
    title: subject,
    icon: "🔕",
    accent: "warning",
    heading: "Auto-Renewal Turned Off",
    subheading: `Hi ${teacherName}`,
    bodyHtml: `<p style="margin:0;">You have successfully turned off auto-renewal for your <strong>${planName}</strong> subscription. Your subscription will not renew automatically. To continue your benefits after your current billing period ends, you will need to renew manually.</p>`,
    ctaLabel: "View Subscription",
    ctaUrl: "https://testkart.in/teacher/subscription",
  });

  return {
    subject,
    html,
    text: `Hi ${teacherName}, auto-renewal for your ${planName} subscription has been turned off. You will need to renew manually when it expires.`,
  };
};
