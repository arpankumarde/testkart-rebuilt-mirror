import { getBrandedEmailHtml } from "./emailBaseTemplate";

export type EmailTemplateResult = {
  subject: string;
  html: string;
  text: string;
};

const formatDate = (date: Date) => {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
};

export const emailTemplatesExtra = {
  paymentFailed: (
    studentName: string,
    orderId: number | string,
    amount: number,
    forStudent = true
  ): EmailTemplateResult => {
    const subject = `Payment Failed: Order #${orderId}`;
    const html = getBrandedEmailHtml({
      title: subject,
      icon: "⚠️",
      accent: "danger",
      heading: "Payment Failed",
      subheading: `Hi ${studentName}`,
      bodyHtml: `<p style="margin:0;">We're writing to let you know that your payment for Order #${orderId} of <strong>₹${amount.toFixed(2)}</strong> failed. Please try your payment again to complete your order.</p>`,
      ctaLabel: "Go to Cart",
      ctaUrl: "https://testkart.in/cart",
      studentAppPromo: forStudent,
    });

    return {
      subject,
      html,
      text: `Hi ${studentName}, your payment for Order #${orderId} of ₹${amount.toFixed(2)} failed. Please try again at https://testkart.in/cart`,
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
    const subject = `Test Results: ${testName}`;
    const html = getBrandedEmailHtml({
      title: subject,
      icon: "🏆",
      accent: "success",
      heading: "Test Completed!",
      subheading: `Hi ${studentName}, here are your results for "${testName}"`,
      table: [
        { label: "Score", value: `${score.toFixed(2)}%`, emphasize: true },
        { label: "Marks Obtained", value: `${totalMarks} / ${maxPossibleMarks}` },
        { label: "Correct Answers", value: `${correctAnswers} / ${totalQuestions}` },
      ],
      ctaLabel: "View Detailed Results",
      ctaUrl: "https://testkart.in/student/tests",
      studentAppPromo: true,
    });

    return {
      subject,
      html,
      text: `Hi ${studentName}, you completed "${testName}" with a score of ${score.toFixed(2)}% (${totalMarks}/${maxPossibleMarks} marks, ${correctAnswers}/${totalQuestions} correct). View details at https://testkart.in/student/tests`,
    };
  },

  freeTestEnrollment: (
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
      bodyHtml: `<p style="margin:0;">You've enrolled in the free test <strong>"${testName}"</strong> by ${teacherName}. You can start practicing right away!</p>`,
      ctaLabel: "Go to My Tests",
      ctaUrl: "https://testkart.in/student/tests",
      studentAppPromo: true,
    });

    return {
      subject,
      html,
      text: `Hi ${studentName}, you've enrolled in "${testName}" by ${teacherName}. Start practicing at https://testkart.in/student/tests`,
    };
  },

  freeCourseEnrollment: (
    studentName: string,
    courseName: string,
    teacherName: string
  ): EmailTemplateResult => {
    const subject = `Enrolled: ${courseName}`;
    const html = getBrandedEmailHtml({
      title: subject,
      icon: "🎬",
      heading: "Enrollment Successful!",
      subheading: `Hi ${studentName}`,
      bodyHtml: `<p style="margin:0;">You've enrolled in the free course <strong>"${courseName}"</strong> by ${teacherName}. Start your learning journey today!</p>`,
      ctaLabel: "Go to My Courses",
      ctaUrl: "https://testkart.in/student/courses",
      studentAppPromo: true,
    });

    return {
      subject,
      html,
      text: `Hi ${studentName}, you've enrolled in course "${courseName}" by ${teacherName}. Start learning at https://testkart.in/student/courses`,
    };
  },

  liveTestEnrolled: (
    studentName: string,
    testName: string,
    scheduledDate: Date
  ): EmailTemplateResult => {
    const subject = `Registration Confirmed: ${testName}`;
    const formattedDate = formatDate(scheduledDate);
    const html = getBrandedEmailHtml({
      title: subject,
      icon: "🎯",
      heading: "Live Test Registration Confirmed",
      subheading: `Hi ${studentName}`,
      bodyHtml: `<p style="margin:0;">You're registered for the live test <strong>"${testName}"</strong> on <strong>${formattedDate}</strong>. Please log in 10 minutes early to ensure you're ready when the test starts.</p>`,
      ctaLabel: "View Live Tests",
      ctaUrl: "https://testkart.in/live-test",
      studentAppPromo: true,
    });

    return {
      subject,
      html,
      text: `Hi ${studentName}, you're registered for live test "${testName}" on ${formattedDate}. Log in 10 minutes early. https://testkart.in/live-test`,
    };
  },

  certificateGenerated: (
    studentName: string,
    itemName: string,
    certificateNumber: string
  ): EmailTemplateResult => {
    const subject = `Certificate Ready: ${itemName}`;
    const html = getBrandedEmailHtml({
      title: subject,
      icon: "🏅",
      accent: "success",
      heading: "Congratulations!",
      subheading: `Hi ${studentName}`,
      bodyHtml: `<p style="margin:0;">Your certificate for <strong>"${itemName}"</strong> is ready!</p>`,
      table: [{ label: "Certificate Number", value: certificateNumber, emphasize: true }],
      ctaLabel: "View My Certificates",
      ctaUrl: "https://testkart.in/student/certificates",
      studentAppPromo: true,
    });

    return {
      subject,
      html,
      text: `Hi ${studentName}, your certificate for "${itemName}" is ready! Certificate #${certificateNumber}. View it at https://testkart.in/student/certificates`,
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
    bookingId: number
  ): EmailTemplateResult => {
    const subject = `Booked: 1:1 session with ${teacherName}`;
    const formattedDate = formatDate(scheduledAt);
    const html = getBrandedEmailHtml({
      title: subject,
      icon: "🗓️",
      accent: "success",
      heading: "Your session is booked!",
      subheading: `Hi ${studentName}`,
      table: [
        { label: "Session", value: sessionTitle },
        { label: "Teacher", value: teacherName },
        { label: "When", value: formattedDate, emphasize: true },
        { label: "Duration", value: `${durationMinutes} minutes` },
      ],
      bodyHtml: `<p style="margin:0;">Join from your dashboard a few minutes before the start time - the room opens automatically.</p>`,
      ctaLabel: "View my bookings",
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
      accent: "danger",
      heading: "Session cancelled",
      subheading: `Hi ${recipientName}`,
      bodyHtml: `<p style="margin:0 0 8px;">Your session <strong>"${sessionTitle}"</strong> with ${otherPartyName}, scheduled for <strong>${formattedDate}</strong>, has been cancelled.</p><p style="margin:0;">Reason: ${reason}</p>`,
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
    bookingId: number
  ): EmailTemplateResult => {
    const subject = `Rescheduled: ${sessionTitle}`;
    const formattedDate = formatDate(newScheduledAt);
    const html = getBrandedEmailHtml({
      title: subject,
      icon: "🔄",
      heading: "Session rescheduled",
      subheading: `Hi ${recipientName}`,
      bodyHtml: `<p style="margin:0;">Your session <strong>"${sessionTitle}"</strong> with ${otherPartyName} has a new time: <strong>${formattedDate}</strong>.</p>`,
      ctaLabel: "View booking",
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
      icon: "❌",
      accent: "danger",
      heading: "Group lesson cancelled",
      subheading: `Hi ${studentName}`,
      bodyHtml: `<p style="margin:0 0 8px;">The group lesson <strong>"${lessonTitle}"</strong> with ${teacherName}, scheduled for <strong>${formattedDate}</strong>, has been cancelled.</p><p style="margin:0;">Reason: ${reason}</p>`,
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
    groupLessonId: number
  ): EmailTemplateResult => {
    const subject = `Enrolled: ${lessonTitle}`;
    const formattedDate = formatDate(scheduledAt);
    const html = getBrandedEmailHtml({
      title: subject,
      icon: "🗓️",
      accent: "success",
      heading: "You're enrolled!",
      subheading: `Hi ${studentName}`,
      table: [
        { label: "Lesson", value: lessonTitle },
        { label: "Teacher", value: teacherName },
        { label: "When", value: formattedDate, emphasize: true },
      ],
      ctaLabel: "View my lessons",
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
      icon: "⚠️",
      accent: "warning",
      heading: "You were removed from a lesson",
      subheading: `Hi ${studentName}`,
      bodyHtml: `<p style="margin:0 0 8px;">${teacherName} removed you from the group lesson <strong>"${lessonTitle}"</strong>.</p><p style="margin:0;">Reason: ${reason}</p>`,
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
    const subject = `Bundle Unlocked: ${bundleName}`;
    const itemsHtml = includedItems.map((item) => `<li>${item}</li>`).join("");
    const html = getBrandedEmailHtml({
      title: subject,
      icon: "📦",
      heading: "Bundle Unlocked!",
      subheading: `Hi ${studentName}`,
      bodyHtml: `
        <p style="margin:0 0 12px;">You have successfully unlocked the bundle <strong>"${bundleName}"</strong> by ${teacherName}.</p>
        <p style="margin:0;">This bundle includes:</p>
        <ul style="margin:8px 0 0;padding-left:20px;line-height:1.8;">${itemsHtml}</ul>
      `,
      ctaLabel: "Go to Dashboard",
      ctaUrl: "https://testkart.in/student/dashboard",
      studentAppPromo: true,
    });

    return {
      subject,
      html,
      text: `Hi ${studentName}, Bundle Unlocked: "${bundleName}" by ${teacherName}. Includes: ${includedItems.join(", ")}. Access it at https://testkart.in/student/dashboard`,
    };
  },

  digitalProductPurchase: (
    studentName: string,
    productName: string,
    teacherName: string
  ): EmailTemplateResult => {
    const subject = `Purchase Confirmed: ${productName}`;
    const html = getBrandedEmailHtml({
      title: subject,
      icon: "🛍️",
      accent: "success",
      heading: "Purchase Successful!",
      subheading: `Hi ${studentName}`,
      bodyHtml: `<p style="margin:0;">You've purchased the digital product <strong>"${productName}"</strong> by ${teacherName}. You can start reading it immediately from your shop purchases.</p>`,
      ctaLabel: "Go to My Purchases",
      ctaUrl: "https://testkart.in/student/shop",
      studentAppPromo: true,
    });

    return {
      subject,
      html,
      text: `Hi ${studentName}, you've purchased "${productName}" by ${teacherName}. Access it from your shop purchases at https://testkart.in/student/shop`,
    };
  },
};
