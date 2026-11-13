import {
  escapeEmailHtml as esc,
  formatEmailDateTime as formatDate,
  formatEmailRupees as rupees,
  getBrandedEmailHtml,
} from "./emailBaseTemplate";

export type EmailTemplateResult = {
  subject: string;
  html: string;
  text: string;
};

export const emailTemplatesExtra = {
  paymentFailed: (
    studentName: string,
    orderId: number | string,
    amount: number,
    forStudent = true
  ): EmailTemplateResult => {
    const subject = `Payment failed for order #${orderId}`;
    const html = getBrandedEmailHtml({
      title: subject,
      preheaderText: "Your payment did not go through. You can try again from your cart.",
      icon: "⚠️",
      eyebrow: "Payment failed",
      accent: "danger",
      heading: "Your payment didn't go through",
      bodyHtml: `
        <p style="margin:0 0 12px;">Hi ${esc(studentName)},</p>
        <p style="margin:0;">The payment of <strong>${rupees(amount)}</strong> for order #${orderId} did not go through. You can try again from your cart.</p>
      `,
      ctaLabel: "Try again",
      ctaUrl: "https://testkart.in/cart",
      studentAppPromo: forStudent,
    });

    return {
      subject,
      html,
      text: `Hi ${studentName}, the payment of ${rupees(amount)} for order #${orderId} did not go through. Try again at https://testkart.in/cart`,
    };
  },

  testCompleted: (
    studentName: string,
    testName: string,
    score: number,
    totalMarks: number,
    maxPossibleMarks: number,
    correctAnswers: number,
    totalQuestions: number
  ): EmailTemplateResult => {
    const subject = `Your result: ${testName}`;
    const scoreLabel = Number.isFinite(score) ? `${Number(score.toFixed(2))}%` : "-";
    const html = getBrandedEmailHtml({
      title: subject,
      preheaderText: `You scored ${scoreLabel}. See the full breakdown.`,
      eyebrow: "Result",
      accent: "success",
      heading: "Your result is in",
      subheading: esc(testName),
      bodyHtml: `<p style="margin:0;">Hi ${esc(studentName)}, here is how you did.</p>`,
      table: [
        { label: "Score", value: scoreLabel, emphasize: true },
        { label: "Marks", value: `${totalMarks} / ${maxPossibleMarks}` },
        { label: "Correct answers", value: `${correctAnswers} / ${totalQuestions}` },
      ],
      ctaLabel: "See full results",
      ctaUrl: "https://testkart.in/student/tests",
      studentAppPromo: true,
    });

    return {
      subject,
      html,
      text: `Hi ${studentName}, you scored ${scoreLabel} in "${testName}" (${totalMarks}/${maxPossibleMarks} marks, ${correctAnswers}/${totalQuestions} correct). See full results at https://testkart.in/student/tests`,
    };
  },

  freeTestEnrollment: (
    studentName: string,
    testName: string,
    teacherName: string
  ): EmailTemplateResult => {
    const subject = `You're enrolled: ${testName}`;
    const html = getBrandedEmailHtml({
      title: subject,
      preheaderText: "Your free test is in your account. You can start right away.",
      eyebrow: "Free test",
      tone: "blue",
      heading: "Your free test is ready",
      bodyHtml: `
        <p style="margin:0 0 12px;">Hi ${esc(studentName)},</p>
        <p style="margin:0;"><strong>${esc(testName)}</strong> by ${esc(teacherName)} is now in your account. You can start right away.</p>
      `,
      ctaLabel: "Start the test",
      ctaUrl: "https://testkart.in/student/tests",
      studentAppPromo: true,
    });

    return {
      subject,
      html,
      text: `Hi ${studentName}, "${testName}" by ${teacherName} is now in your account. Start at https://testkart.in/student/tests`,
    };
  },

  freeCourseEnrollment: (
    studentName: string,
    courseName: string,
    teacherName: string
  ): EmailTemplateResult => {
    const subject = `You're enrolled: ${courseName}`;
    const html = getBrandedEmailHtml({
      title: subject,
      preheaderText: "Your free course is in your account. Start with the first lesson.",
      eyebrow: "Free course",
      tone: "lavender",
      heading: "Your free course is ready",
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
  },

  liveTestEnrolled: (
    studentName: string,
    testName: string,
    scheduledDate: Date
  ): EmailTemplateResult => {
    const subject = `You're registered: ${testName}`;
    const formattedDate = formatDate(scheduledDate);
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
      text: `Hi ${studentName}, you're registered for "${testName}", starting ${formattedDate}. Log in 10 minutes early. https://testkart.in/live-test`,
    };
  },

  newReviewReceived: (
    teacherName: string,
    studentName: string,
    itemName: string,
    itemType: "test" | "product" | "course",
    rating: number,
    reviewText?: string
  ): EmailTemplateResult => {
    const subject = `New Review Received`;
    const html = getBrandedEmailHtml({
      title: subject,
      icon: "⭐",
      heading: "New Review Received",
      subheading: `Hi ${teacherName}`,
      bodyHtml: `
        <p style="margin:0;"><strong>${studentName}</strong> left a new <strong>${rating}★</strong> review on your ${itemType} <strong>"${itemName}"</strong>.</p>
        ${
          reviewText
            ? `<div style="background-color:#ffffff;border:1px solid #E5E7EB;padding:16px;border-radius:8px;margin:16px 0 0;">
               <p style="margin:0;font-style:italic;">"${reviewText}"</p>
             </div>`
            : ""
        }
      `,
      ctaLabel: "View All Reviews",
      ctaUrl: "https://testkart.in/teacher/reviews",
    });

    return {
      subject,
      html,
      text: `Hi ${teacherName}, ${studentName} left a ${rating}★ review on "${itemName}".${
        reviewText ? ` They said: "${reviewText}"` : ""
      } View reviews at https://testkart.in/teacher/reviews`,
    };
  },

  mentorshipBookingConfirmed: (
    studentName: string,
    teacherName: string,
    sessionTitle: string,
    scheduledAt: Date,
    durationMinutes: number,
    bookingId: string
  ): EmailTemplateResult => {
    const subject = `Booked: 1:1 session with ${teacherName}`;
    const formattedDate = formatDate(scheduledAt);
    const html = getBrandedEmailHtml({
      title: subject,
      preheaderText: `${formattedDate}. Join from your dashboard a few minutes early.`,
      eyebrow: "Session booked",
      tone: "lavender",
      heading: "Your session is booked",
      bodyHtml: `
        <p style="margin:0 0 12px;">Hi ${esc(studentName)},</p>
        <p style="margin:0;">Join from your dashboard a few minutes before the start time. The room opens automatically.</p>
      `,
      table: [
        { label: "Session", value: esc(sessionTitle) },
        { label: "Teacher", value: esc(teacherName) },
        { label: "Starts", value: formattedDate, emphasize: true },
        { label: "Duration", value: `${durationMinutes} minutes` },
      ],
      ctaLabel: "View my booking",
      ctaUrl: `https://testkart.in/student/mentorship/bookings/${bookingId}`,
      studentAppPromo: true,
    });

    return {
      subject,
      html,
      text: `Hi ${studentName}, your ${durationMinutes}-minute session "${sessionTitle}" with ${teacherName} is booked for ${formattedDate}. View it at https://testkart.in/student/mentorship/bookings/${bookingId}`,
    };
  },

  mentorshipBookingCancelled: (
    recipientName: string,
    otherPartyName: string,
    sessionTitle: string,
    scheduledAt: Date,
    reason: string,
    forStudent: boolean
  ): EmailTemplateResult => {
    const subject = `Cancelled: ${sessionTitle}`;
    const formattedDate = formatDate(scheduledAt);
    const html = getBrandedEmailHtml({
      title: subject,
      icon: "❌",
      eyebrow: "Session cancelled",
      accent: "danger",
      heading: "Session cancelled",
      subheading: `Hi ${esc(recipientName)}`,
      bodyHtml: `<p style="margin:0 0 8px;">Your session <strong>"${esc(sessionTitle)}"</strong> with ${esc(otherPartyName)}, scheduled for <strong>${formattedDate}</strong>, has been cancelled.</p><p style="margin:0;">Reason: ${esc(reason)}</p>`,
      ctaLabel: forStudent ? "Find another session" : "Go to Dashboard",
      ctaUrl: forStudent ? "https://testkart.in/mentorship" : "https://testkart.in/teacher/dashboard",
      studentAppPromo: forStudent,
    });

    return {
      subject,
      html,
      text: `Hi ${recipientName}, your session "${sessionTitle}" with ${otherPartyName} on ${formattedDate} has been cancelled. Reason: ${reason}`,
    };
  },

  mentorshipBookingRescheduled: (
    recipientName: string,
    otherPartyName: string,
    sessionTitle: string,
    newScheduledAt: Date,
    forStudent: boolean,
    bookingId: string
  ): EmailTemplateResult => {
    const subject = `Rescheduled: ${sessionTitle}`;
    const formattedDate = formatDate(newScheduledAt);
    const html = getBrandedEmailHtml({
      title: subject,
      icon: "🔄",
      eyebrow: "New time",
      accent: "info",
      heading: "Session rescheduled",
      subheading: `Hi ${esc(recipientName)}`,
      bodyHtml: `<p style="margin:0;">Your session <strong>"${esc(sessionTitle)}"</strong> with ${esc(otherPartyName)} has a new time: <strong>${formattedDate}</strong>.</p>`,
      ctaLabel: forStudent ? "View my booking" : "View booking",
      ctaUrl: forStudent
        ? `https://testkart.in/student/mentorship/bookings/${bookingId}`
        : "https://testkart.in/teacher/mentorship/bookings",
      studentAppPromo: forStudent,
    });

    return {
      subject,
      html,
      text: `Hi ${recipientName}, your session "${sessionTitle}" with ${otherPartyName} was rescheduled to ${formattedDate}.`,
    };
  },

  groupLessonCancelled: (
    studentName: string,
    teacherName: string,
    lessonTitle: string,
    scheduledAt: Date,
    reason: string
  ): EmailTemplateResult => {
    const subject = `Cancelled: ${lessonTitle}`;
    const formattedDate = formatDate(scheduledAt);
    const html = getBrandedEmailHtml({
      title: subject,
      eyebrow: "Lesson cancelled",
      accent: "danger",
      heading: "Your group lesson was cancelled",
      bodyHtml: `
        <p style="margin:0 0 12px;">Hi ${esc(studentName)},</p>
        <p style="margin:0;"><strong>${esc(lessonTitle)}</strong> with ${esc(teacherName)}, planned for <strong>${formattedDate}</strong>, has been cancelled.</p>
      `,
      table: [{ label: "Reason", value: esc(reason) }],
      ctaLabel: "Find another lesson",
      ctaUrl: "https://testkart.in/mentorship/group-lessons",
      studentAppPromo: true,
    });

    return {
      subject,
      html,
      text: `Hi ${studentName}, the group lesson "${lessonTitle}" with ${teacherName} on ${formattedDate} has been cancelled. Reason: ${reason}`,
    };
  },

  groupLessonEnrolled: (
    studentName: string,
    teacherName: string,
    lessonTitle: string,
    scheduledAt: Date,
    groupLessonId: string
  ): EmailTemplateResult => {
    const subject = `You're enrolled: ${lessonTitle}`;
    const formattedDate = formatDate(scheduledAt);
    const html = getBrandedEmailHtml({
      title: subject,
      preheaderText: `Your seat is confirmed for ${formattedDate}.`,
      eyebrow: "Group lesson",
      accent: "success",
      heading: "You're enrolled",
      bodyHtml: `<p style="margin:0;">Hi ${esc(studentName)}, your seat is confirmed.</p>`,
      table: [
        { label: "Lesson", value: esc(lessonTitle) },
        { label: "Teacher", value: esc(teacherName) },
        { label: "Starts", value: formattedDate, emphasize: true },
      ],
      ctaLabel: "View my lesson",
      ctaUrl: `https://testkart.in/student/mentorship/group-lessons/${groupLessonId}`,
      studentAppPromo: true,
    });

    return {
      subject,
      html,
      text: `Hi ${studentName}, you're enrolled in "${lessonTitle}" with ${teacherName} on ${formattedDate}. https://testkart.in/student/mentorship/group-lessons/${groupLessonId}`,
    };
  },

  groupLessonRemoved: (
    studentName: string,
    teacherName: string,
    lessonTitle: string,
    reason: string
  ): EmailTemplateResult => {
    const subject = `Removed from: ${lessonTitle}`;
    const html = getBrandedEmailHtml({
      title: subject,
      eyebrow: "Group lesson",
      accent: "warning",
      heading: "You were removed from a lesson",
      bodyHtml: `
        <p style="margin:0 0 12px;">Hi ${esc(studentName)},</p>
        <p style="margin:0;">${esc(teacherName)} removed you from the group lesson <strong>${esc(lessonTitle)}</strong>.</p>
      `,
      table: [{ label: "Reason", value: esc(reason) }],
      ctaLabel: "Find another lesson",
      ctaUrl: "https://testkart.in/mentorship/group-lessons",
      studentAppPromo: true,
    });

    return {
      subject,
      html,
      text: `Hi ${studentName}, ${teacherName} removed you from "${lessonTitle}". Reason: ${reason}`,
    };
  },

  newPurchaseNotification: (
    teacherName: string,
    studentName: string,
    itemName: string,
    itemType: string,
    amount: number
  ): EmailTemplateResult => {
    const subject = `New Purchase: ${itemName}`;
    const html = getBrandedEmailHtml({
      title: subject,
      icon: "🎉",
      accent: "success",
      heading: "New Purchase!",
      subheading: `Hi ${teacherName}`,
      bodyHtml: `<p style="margin:0;">Great news! <strong>${studentName}</strong> just purchased your ${itemType} <strong>"${itemName}"</strong> for <strong>₹${amount.toFixed(2)}</strong>. Keep up the great work!</p>`,
      ctaLabel: "Go to Dashboard",
      ctaUrl: "https://testkart.in/teacher/dashboard",
    });

    return {
      subject,
      html,
      text: `Hi ${teacherName}, New Purchase! ${studentName} purchased "${itemName}" for ₹${amount.toFixed(2)}. Dashboard: https://testkart.in/teacher/dashboard`,
    };
  },

  bundleEnrollmentStudent: (
    studentName: string,
    bundleName: string,
    teacherName: string,
    includedItems: string[]
  ): EmailTemplateResult => {
    const subject = `Your bundle is unlocked: ${bundleName}`;
    const itemsHtml = includedItems.map((item) => `<li style="margin:0 0 4px;">${esc(item)}</li>`).join("");
    const html = getBrandedEmailHtml({
      title: subject,
      preheaderText: "Everything in your bundle is in your account.",
      eyebrow: "Bundle",
      tone: "sage",
      heading: "Your bundle is unlocked",
      bodyHtml: `
        <p style="margin:0 0 12px;">Hi ${esc(studentName)},</p>
        <p style="margin:0 0 12px;"><strong>${esc(bundleName)}</strong> by ${esc(teacherName)} is now in your account. It includes:</p>
        <ul style="margin:0;padding:0 0 0 20px;">${itemsHtml}</ul>
      `,
      ctaLabel: "Open my dashboard",
      ctaUrl: "https://testkart.in/student/dashboard",
      studentAppPromo: true,
    });

    return {
      subject,
      html,
      text: `Hi ${studentName}, the bundle "${bundleName}" by ${teacherName} is now in your account. It includes: ${includedItems.join(", ")}. Open it at https://testkart.in/student/dashboard`,
    };
  },

  digitalProductPurchase: (
    studentName: string,
    productName: string,
    teacherName: string
  ): EmailTemplateResult => {
    const subject = `Your study notes are ready: ${productName}`;
    const html = getBrandedEmailHtml({
      title: subject,
      preheaderText: "Your study notes are in your account. Start reading right away.",
      eyebrow: "Study notes",
      tone: "butter",
      heading: "Your study notes are ready",
      bodyHtml: `
        <p style="margin:0 0 12px;">Hi ${esc(studentName)},</p>
        <p style="margin:0;"><strong>${esc(productName)}</strong> by ${esc(teacherName)} is now in your account. You can start reading right away.</p>
      `,
      ctaLabel: "Read now",
      ctaUrl: "https://testkart.in/student/shop",
      studentAppPromo: true,
    });

    return {
      subject,
      html,
      text: `Hi ${studentName}, "${productName}" by ${teacherName} is now in your account. Read it at https://testkart.in/student/shop`,
    };
  },
};
