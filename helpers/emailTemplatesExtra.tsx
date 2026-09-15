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
    amount: number
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
      ctaUrl: "https://testkart.in/mock-test/live",
    });

    return {
      subject,
      html,
      text: `Hi ${studentName}, you're registered for live test "${testName}" on ${formattedDate}. Log in 10 minutes early. https://testkart.in/mock-test/live`,
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
    });

    return {
      subject,
      html,
      text: `Hi ${studentName}, you've purchased "${productName}" by ${teacherName}. Access it from your shop purchases at https://testkart.in/student/shop`,
    };
  },
};
