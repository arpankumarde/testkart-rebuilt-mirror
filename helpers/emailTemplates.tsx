import { format } from "date-fns";
import {
  escapeEmailHtml as esc,
  formatEmailDate as formatIstDate,
  formatEmailDateTime as formatIstDateTime,
  formatEmailRupees as rupees,
  getBrandedEmailHtml,
  type EmailAccent,
} from "./emailBaseTemplate";

const ORDER_ITEM_LABELS: Record<"course" | "test" | "bundle" | "digital_product", string> = {
  course: "Course",
  test: "Test series",
  bundle: "Bundle",
  digital_product: "Study notes",
};

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
  const subject = "Welcome to Testkart";
  const html = getBrandedEmailHtml({
    title: subject,
    preheaderText: "Your account is ready. Pick your exam and take a mock test.",
    eyebrow: "Welcome",
    heading: `Welcome, ${esc(displayName)}`,
    bodyHtml: `
      <p style="margin:0 0 12px;">Your Testkart account is ready.</p>
      <p style="margin:0;">Pick your exam, take a mock test and see where you stand.</p>
    `,
    ctaLabel: "Go to my dashboard",
    ctaUrl: "https://testkart.in/student/dashboard",
    studentAppPromo: true,
  });

  return {
    subject,
    html,
    text: `Welcome to Testkart, ${displayName}. Your account is ready. Pick your exam and take a mock test: https://testkart.in/student/dashboard`,
  };
};

export const orderConfirmation = (
  orderDetails: OrderDetails
): EmailTemplateResult => {
  const subject = `Your Testkart order #${orderDetails.orderId} is confirmed`;

  const html = getBrandedEmailHtml({
    title: subject,
    preheaderText: "Everything in this order is ready in your dashboard.",
    eyebrow: "Order confirmed",
    accent: "success",
    heading: "Thanks, your order is confirmed",
    subheading: `Order #${orderDetails.orderId} &middot; ${formatIstDate(orderDetails.date)}`,
    bodyHtml: `<p style="margin:0;">Everything in this order is ready in your dashboard.</p>`,
    table: [
      ...orderDetails.items.map((item) => ({
        label: `<span style="color:#21283B;font-weight:600;">${esc(item.title)}</span><br><span style="font-size:12px;">${ORDER_ITEM_LABELS[item.type]}</span>`,
        value: item.price > 0 ? rupees(item.price) : "Free",
      })),
      { label: "Total", value: rupees(orderDetails.totalAmount), emphasize: true },
    ],
    ctaLabel: "Open my dashboard",
    ctaUrl: "https://testkart.in/student/dashboard",
    studentAppPromo: true,
  });

  return {
    subject,
    html,
    text: `Your order #${orderDetails.orderId} for ${rupees(orderDetails.totalAmount)} is confirmed. Everything in it is ready at https://testkart.in/student/dashboard`,
  };
};

export const testEnrollment = (
  studentName: string,
  testName: string,
  teacherName: string
): EmailTemplateResult => {
  const subject = `You're enrolled: ${testName}`;
  const html = getBrandedEmailHtml({
    title: subject,
    preheaderText: "Your test series is in your account. Start whenever you're ready.",
    eyebrow: "Test series",
    tone: "blue",
    heading: "Your test series is ready",
    bodyHtml: `
      <p style="margin:0 0 12px;">Hi ${esc(studentName)},</p>
      <p style="margin:0;"><strong>${esc(testName)}</strong> by ${esc(teacherName)} is now in your account. Start with the first test whenever you're ready.</p>
    `,
    ctaLabel: "Start practising",
    ctaUrl: "https://testkart.in/student/tests",
    studentAppPromo: true,
  });

  return {
    subject,
    html,
    text: `Hi ${studentName}, "${testName}" by ${teacherName} is now in your account. Start practising at https://testkart.in/student/tests`,
  };
};

export const courseEnrollment = (
  studentName: string,
  courseName: string,
  teacherName: string
): EmailTemplateResult => {
  const subject = `You're enrolled: ${courseName}`;
  const html = getBrandedEmailHtml({
    title: subject,
    preheaderText: "Your course is in your account. Start with the first lesson.",
    eyebrow: "Course",
    tone: "lavender",
    heading: "Your course is ready",
    bodyHtml: `
      <p style="margin:0 0 12px;">Hi ${esc(studentName)},</p>
      <p style="margin:0;"><strong>${esc(courseName)}</strong> by ${esc(teacherName)} is now in your account. Start with the first lesson whenever you're ready.</p>
    `,
    ctaLabel: "Start learning",
    ctaUrl: "https://testkart.in/student/courses",
    studentAppPromo: true,
  });

  return {
    subject,
    html,
    text: `Hi ${studentName}, "${courseName}" by ${teacherName} is now in your account. Start learning at https://testkart.in/student/courses`,
  };
};

export const bundleEnrollment = (
  studentName: string,
  bundleName: string,
  teacherName: string
): EmailTemplateResult => {
  const subject = `Your bundle is unlocked: ${bundleName}`;
  const html = getBrandedEmailHtml({
    title: subject,
    preheaderText: "Everything in your bundle is in your account.",
    eyebrow: "Bundle",
    tone: "sage",
    heading: "Your bundle is unlocked",
    bodyHtml: `
      <p style="margin:0 0 12px;">Hi ${esc(studentName)},</p>
      <p style="margin:0;"><strong>${esc(bundleName)}</strong> by ${esc(teacherName)} is now in your account, with every course and test it includes.</p>
    `,
    ctaLabel: "Open my dashboard",
    ctaUrl: "https://testkart.in/student/dashboard",
    studentAppPromo: true,
  });

  return {
    subject,
    html,
    text: `Hi ${studentName}, the bundle "${bundleName}" is now in your account. Open it at https://testkart.in/student/dashboard`,
  };
};

export const liveTestEnrollment = (
  studentName: string,
  testName: string,
  scheduledDate: Date
): EmailTemplateResult => {
  const subject = `You're registered: ${testName}`;
  const formattedDate = formatIstDateTime(scheduledDate);
  const html = getBrandedEmailHtml({
    title: subject,
    preheaderText: `Starts ${formattedDate}. Log in 10 minutes early.`,
    eyebrow: "Live test",
    tone: "mint",
    heading: "You're registered",
    bodyHtml: `
      <p style="margin:0 0 12px;">Hi ${esc(studentName)},</p>
      <p style="margin:0;">You're registered for <strong>${esc(testName)}</strong>. Log in 10 minutes early so you're ready when it starts.</p>
    `,
    table: [{ label: "Starts", value: formattedDate, emphasize: true }],
    ctaLabel: "View live tests",
    ctaUrl: "https://testkart.in/live-test",
    studentAppPromo: true,
  });

  return {
    subject,
    html,
    text: `Hi ${studentName}, you're registered for "${testName}", starting ${formattedDate}. Log in 10 minutes early.`,
  };
};

export const paymentSuccessful = (
  orderDetails: OrderDetails
): EmailTemplateResult => {
  const subject = `Payment received for order #${orderDetails.orderId}`;
  const html = getBrandedEmailHtml({
    title: subject,
    eyebrow: "Payment received",
    accent: "success",
    heading: "We've received your payment",
    bodyHtml: `<p style="margin:0;">Thanks for your payment for order #${orderDetails.orderId}.</p>`,
    table: [{ label: "Amount paid", value: rupees(orderDetails.totalAmount), emphasize: true }],
    studentAppPromo: true,
  });

  return {
    subject,
    html,
    text: `We've received your payment of ${rupees(orderDetails.totalAmount)} for order #${orderDetails.orderId}.`,
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

const STUDENT_WITHDRAWAL_COPY: Record<
  "completed" | "failed" | "cancelled" | "pending",
  { subject: string; eyebrow: string; accent: EmailAccent; heading: string; line: (amount: string) => string }
> = {
  completed: {
    subject: "Your withdrawal is complete",
    eyebrow: "Withdrawal complete",
    accent: "success",
    heading: "Your money is on its way",
    line: (amount) => `We've sent <strong>${amount}</strong> to your bank account. It should reach you shortly.`,
  },
  failed: {
    subject: "Your withdrawal could not be completed",
    eyebrow: "Withdrawal failed",
    accent: "danger",
    heading: "Your withdrawal could not be completed",
    line: (amount) => `We could not complete your withdrawal of <strong>${amount}</strong>. Check your wallet for details, or write to us and we'll help.`,
  },
  cancelled: {
    subject: "Your withdrawal was cancelled",
    eyebrow: "Withdrawal cancelled",
    accent: "warning",
    heading: "Your withdrawal was cancelled",
    line: (amount) => `Your withdrawal request for <strong>${amount}</strong> was cancelled. Check your wallet for details.`,
  },
  pending: {
    subject: "Your withdrawal is being processed",
    eyebrow: "Withdrawal",
    accent: "info",
    heading: "Your withdrawal is being processed",
    line: (amount) => `Your withdrawal request for <strong>${amount}</strong> is being processed.`,
  },
};

export const withdrawalProcessed = (
  teacherName: string,
  amount: number,
  status: "completed" | "failed" | "cancelled" | "pending",
  forStudent = false
): EmailTemplateResult => {
  if (forStudent) {
    const copy = STUDENT_WITHDRAWAL_COPY[status];
    return {
      subject: copy.subject,
      html: getBrandedEmailHtml({
        title: copy.subject,
        eyebrow: copy.eyebrow,
        accent: copy.accent,
        heading: copy.heading,
        bodyHtml: `
          <p style="margin:0 0 12px;">Hi ${esc(teacherName)},</p>
          <p style="margin:0;">${copy.line(rupees(amount))}</p>
        `,
        ctaLabel: "View my wallet",
        ctaUrl: "https://testkart.in/student/wallet",
        studentAppPromo: true,
      }),
      text: `Hi ${teacherName}, your withdrawal of ${rupees(amount)} is now ${status}. See your wallet: https://testkart.in/student/wallet`,
    };
  }

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
    preheaderText: `${esc(sponsorName)} has enrolled you. It is ready in your dashboard.`,
    eyebrow: "Sponsored for you",
    tone: "mint",
    heading: "You've been enrolled",
    bodyHtml: `
      <p style="margin:0 0 12px;">Hi ${esc(studentName)},</p>
      <p style="margin:0;"><strong>${esc(sponsorName)}</strong> has enrolled you in <strong>${esc(itemName)}</strong>. It is ready in your dashboard.</p>
    `,
    ctaLabel: "Open my dashboard",
    ctaUrl: "https://testkart.in/student/dashboard",
    studentAppPromo: true,
  });

  return {
    subject,
    html,
    text: `Hi ${studentName}, ${sponsorName} has enrolled you in "${itemName}". Open it at https://testkart.in/student/dashboard`,
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
    bodyHtml: `<p style="margin:0;">We've processed your request to cancel your <strong>${planName}</strong> subscription. You will continue to have access to all your subscription benefits until <strong>${format(endDate, "PPP")}</strong>. You won't be charged again, and after that date your account moves to the Free plan.</p>`,
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
