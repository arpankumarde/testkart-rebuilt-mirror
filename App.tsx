import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import { GlobalContextProviders } from "./components/_globalContextProviders";
import Page_0 from "./pages/$.tsx";
import PageLayout_0 from "./pages/$.pageLayout.tsx";
import Page_1 from "./pages/blog.tsx";
import PageLayout_1 from "./pages/blog.pageLayout.tsx";
import Page_2 from "./pages/cart.tsx";
import PageLayout_2 from "./pages/cart.pageLayout.tsx";
import Page_3 from "./pages/help.tsx";
import PageLayout_3 from "./pages/help.pageLayout.tsx";
import Page_4 from "./pages/sell.tsx";
import PageLayout_4 from "./pages/sell.pageLayout.tsx";
import Page_5 from "./pages/about.tsx";
import PageLayout_5 from "./pages/about.pageLayout.tsx";
import Page_6 from "./pages/admin.tsx";
import PageLayout_6 from "./pages/admin.pageLayout.tsx";
import Page_7 from "./pages/exams.tsx";
import PageLayout_7 from "./pages/exams.pageLayout.tsx";
import Page_8 from "./pages/login.tsx";
import PageLayout_8 from "./pages/login.pageLayout.tsx";
import Page_9 from "./pages/terms.tsx";
import PageLayout_9 from "./pages/terms.pageLayout.tsx";
import Page_10 from "./pages/_index.tsx";
import PageLayout_10 from "./pages/_index.pageLayout.tsx";
import Page_11 from "./pages/course.tsx";
import PageLayout_11 from "./pages/course.pageLayout.tsx";
import Page_12 from "./pages/refund.tsx";
import PageLayout_12 from "./pages/refund.pageLayout.tsx";
import Page_13 from "./pages/search.tsx";
import PageLayout_13 from "./pages/search.pageLayout.tsx";
import Page_14 from "./pages/signup.tsx";
import PageLayout_14 from "./pages/signup.pageLayout.tsx";
import Page_15 from "./pages/bundles.tsx";
import PageLayout_15 from "./pages/bundles.pageLayout.tsx";
import Page_16 from "./pages/careers.tsx";
import PageLayout_16 from "./pages/careers.pageLayout.tsx";
import Page_17 from "./pages/contact.tsx";
import PageLayout_17 from "./pages/contact.pageLayout.tsx";
import Page_18 from "./pages/privacy.tsx";
import PageLayout_18 from "./pages/privacy.pageLayout.tsx";
import Page_19 from "./pages/teachers.tsx";
import PageLayout_19 from "./pages/teachers.pageLayout.tsx";
import Page_20 from "./pages/mock-test.tsx";
import PageLayout_20 from "./pages/mock-test.pageLayout.tsx";
import Page_21 from "./pages/admin.blog.tsx";
import PageLayout_21 from "./pages/admin.blog.pageLayout.tsx";
import Page_22 from "./pages/admin.news.tsx";
import PageLayout_22 from "./pages/admin.news.pageLayout.tsx";
import Page_23 from "./pages/admin.login.tsx";
import PageLayout_23 from "./pages/admin.login.pageLayout.tsx";
import Page_24 from "./pages/admin.notes.tsx";
import PageLayout_24 from "./pages/admin.notes.pageLayout.tsx";
import Page_25 from "./pages/admin.sales.tsx";
import PageLayout_25 from "./pages/admin.sales.pageLayout.tsx";
import Page_26 from "./pages/study-notes.tsx";
import PageLayout_26 from "./pages/study-notes.pageLayout.tsx";
import Page_27 from "./pages/sell.courses.tsx";
import PageLayout_27 from "./pages/sell.courses.pageLayout.tsx";
import Page_28 from "./pages/student.live.tsx";
import PageLayout_28 from "./pages/student.live.pageLayout.tsx";
import Page_29 from "./pages/student.shop.tsx";
import PageLayout_29 from "./pages/student.shop.pageLayout.tsx";
import Page_30 from "./pages/admin.bundles.tsx";
import PageLayout_30 from "./pages/admin.bundles.pageLayout.tsx";
import Page_31 from "./pages/admin.careers.tsx";
import PageLayout_31 from "./pages/admin.careers.pageLayout.tsx";
import Page_32 from "./pages/admin.content.tsx";
import PageLayout_32 from "./pages/admin.content.pageLayout.tsx";
import Page_33 from "./pages/admin.courses.tsx";
import PageLayout_33 from "./pages/admin.courses.pageLayout.tsx";
import Page_34 from "./pages/admin.finance.tsx";
import PageLayout_34 from "./pages/admin.finance.pageLayout.tsx";
import Page_35 from "./pages/admin.profile.tsx";
import PageLayout_35 from "./pages/admin.profile.pageLayout.tsx";
import Page_36 from "./pages/admin.support.tsx";
import PageLayout_36 from "./pages/admin.support.pageLayout.tsx";
import Page_37 from "./pages/app-turnstile.tsx";
import PageLayout_37 from "./pages/app-turnstile.pageLayout.tsx";
import Page_38 from "./pages/close-account.tsx";
import PageLayout_38 from "./pages/close-account.pageLayout.tsx";
import Page_39 from "./pages/student.tests.tsx";
import PageLayout_39 from "./pages/student.tests.pageLayout.tsx";
import Page_40 from "./pages/teacher.login.tsx";
import PageLayout_40 from "./pages/teacher.login.pageLayout.tsx";
import Page_41 from "./pages/teacher.trash.tsx";
import PageLayout_41 from "./pages/teacher.trash.pageLayout.tsx";
import Page_42 from "./pages/verify-mobile.tsx";
import PageLayout_42 from "./pages/verify-mobile.pageLayout.tsx";
import Page_43 from "./pages/admin.ai-usage.tsx";
import PageLayout_43 from "./pages/admin.ai-usage.pageLayout.tsx";
import Page_44 from "./pages/admin.api-docs.tsx";
import PageLayout_44 from "./pages/admin.api-docs.pageLayout.tsx";
import Page_45 from "./pages/admin.settings.tsx";
import PageLayout_45 from "./pages/admin.settings.pageLayout.tsx";
import Page_46 from "./pages/admin.students.tsx";
import PageLayout_46 from "./pages/admin.students.pageLayout.tsx";
import Page_47 from "./pages/admin.teachers.tsx";
import PageLayout_47 from "./pages/admin.teachers.pageLayout.tsx";
import Page_48 from "./pages/blog.$blogSlug.tsx";
import PageLayout_48 from "./pages/blog.$blogSlug.pageLayout.tsx";
import Page_49 from "./pages/mock-test.live.tsx";
import PageLayout_49 from "./pages/mock-test.live.pageLayout.tsx";
import Page_50 from "./pages/order.$orderId.tsx";
import PageLayout_50 from "./pages/order.$orderId.pageLayout.tsx";
import Page_51 from "./pages/sell.mock-test.tsx";
import PageLayout_51 from "./pages/sell.mock-test.pageLayout.tsx";
import Page_52 from "./pages/student.orders.tsx";
import PageLayout_52 from "./pages/student.orders.pageLayout.tsx";
import Page_53 from "./pages/student.wallet.tsx";
import PageLayout_53 from "./pages/student.wallet.pageLayout.tsx";
import Page_54 from "./pages/teacher.signup.tsx";
import PageLayout_54 from "./pages/teacher.signup.pageLayout.tsx";
import Page_55 from "./pages/admin.catalogue.tsx";
import PageLayout_55 from "./pages/admin.catalogue.pageLayout.tsx";
import Page_56 from "./pages/admin.dashboard.tsx";
import PageLayout_56 from "./pages/admin.dashboard.pageLayout.tsx";
import Page_57 from "./pages/exams.$examSlug.tsx";
import PageLayout_57 from "./pages/exams.$examSlug.pageLayout.tsx";
import Page_58 from "./pages/news-and-events.tsx";
import PageLayout_58 from "./pages/news-and-events.pageLayout.tsx";
import Page_59 from "./pages/student.courses.tsx";
import PageLayout_59 from "./pages/student.courses.pageLayout.tsx";
import Page_60 from "./pages/student.profile.tsx";
import PageLayout_60 from "./pages/student.profile.pageLayout.tsx";
import Page_61 from "./pages/teacher.bundles.tsx";
import PageLayout_61 from "./pages/teacher.bundles.pageLayout.tsx";
import Page_62 from "./pages/teacher.courses.tsx";
import PageLayout_62 from "./pages/teacher.courses.pageLayout.tsx";
import Page_63 from "./pages/teacher.reports.tsx";
import PageLayout_63 from "./pages/teacher.reports.pageLayout.tsx";
import Page_64 from "./pages/teacher.reviews.tsx";
import PageLayout_64 from "./pages/teacher.reviews.pageLayout.tsx";
import Page_65 from "./pages/teacher.support.tsx";
import PageLayout_65 from "./pages/teacher.support.pageLayout.tsx";
import Page_66 from "./pages/admin.blog.e.$id.tsx";
import PageLayout_66 from "./pages/admin.blog.e.$id.pageLayout.tsx";
import Page_67 from "./pages/admin.live-tests.tsx";
import PageLayout_67 from "./pages/admin.live-tests.pageLayout.tsx";
import Page_68 from "./pages/admin.news.e.$id.tsx";
import PageLayout_68 from "./pages/admin.news.e.$id.pageLayout.tsx";
import Page_69 from "./pages/payment.callback.tsx";
import PageLayout_69 from "./pages/payment.callback.pageLayout.tsx";
import Page_70 from "./pages/teacher.products.tsx";
import PageLayout_70 from "./pages/teacher.products.pageLayout.tsx";
import Page_71 from "./pages/teacher.settings.tsx";
import PageLayout_71 from "./pages/teacher.settings.pageLayout.tsx";
import Page_72 from "./pages/teacher.students.tsx";
import PageLayout_72 from "./pages/teacher.students.pageLayout.tsx";
import Page_73 from "./pages/admin.test-series.tsx";
import PageLayout_73 from "./pages/admin.test-series.pageLayout.tsx";
import Page_74 from "./pages/ai-quiz-generator.tsx";
import PageLayout_74 from "./pages/ai-quiz-generator.pageLayout.tsx";
import Page_75 from "./pages/courses.$courseId.tsx";
import PageLayout_75 from "./pages/courses.$courseId.pageLayout.tsx";
import Page_76 from "./pages/help.$articleSlug.tsx";
import PageLayout_76 from "./pages/help.$articleSlug.pageLayout.tsx";
import Page_77 from "./pages/student.dashboard.tsx";
import PageLayout_77 from "./pages/student.dashboard.pageLayout.tsx";
import Page_78 from "./pages/teacher.dashboard.tsx";
import PageLayout_78 from "./pages/teacher.dashboard.pageLayout.tsx";
import Page_79 from "./pages/admin.ai-questions.tsx";
import PageLayout_79 from "./pages/admin.ai-questions.pageLayout.tsx";
import Page_80 from "./pages/admin.exam-content.tsx";
import PageLayout_80 from "./pages/admin.exam-content.pageLayout.tsx";
import Page_81 from "./pages/admin.static-pages.tsx";
import PageLayout_81 from "./pages/admin.static-pages.pageLayout.tsx";
import Page_82 from "./pages/admin.transactions.tsx";
import PageLayout_82 from "./pages/admin.transactions.pageLayout.tsx";
import Page_83 from "./pages/course.$courseSlug.tsx";
import PageLayout_83 from "./pages/course.$courseSlug.pageLayout.tsx";
import Page_84 from "./pages/portal.$testItemId.tsx";
import PageLayout_84 from "./pages/portal.$testItemId.pageLayout.tsx";
import Page_85 from "./pages/teacher.live-tests.tsx";
import PageLayout_85 from "./pages/teacher.live-tests.pageLayout.tsx";
import Page_86 from "./pages/teacher.onboarding.tsx";
import PageLayout_86 from "./pages/teacher.onboarding.pageLayout.tsx";
import Page_87 from "./pages/admin.blog.category.tsx";
import PageLayout_87 from "./pages/admin.blog.category.pageLayout.tsx";
import Page_88 from "./pages/admin.blog.comments.tsx";
import PageLayout_88 from "./pages/admin.blog.comments.pageLayout.tsx";
import Page_89 from "./pages/admin.dashboard.old.tsx";
import PageLayout_89 from "./pages/admin.dashboard.old.pageLayout.tsx";
import Page_90 from "./pages/admin.subscriptions.tsx";
import PageLayout_90 from "./pages/admin.subscriptions.pageLayout.tsx";
import Page_91 from "./pages/bundles.$bundleSlug.tsx";
import PageLayout_91 from "./pages/bundles.$bundleSlug.pageLayout.tsx";
import Page_92 from "./pages/careers.$careerSlug.tsx";
import PageLayout_92 from "./pages/careers.$careerSlug.pageLayout.tsx";
import Page_93 from "./pages/expert.$teacherSlug.tsx";
import PageLayout_93 from "./pages/expert.$teacherSlug.pageLayout.tsx";
import Page_94 from "./pages/mock-test.$testSlug.tsx";
import PageLayout_94 from "./pages/mock-test.$testSlug.pageLayout.tsx";
import Page_95 from "./pages/sell.host-live-exam.tsx";
import PageLayout_95 from "./pages/sell.host-live-exam.pageLayout.tsx";
import Page_96 from "./pages/teacher.create-test.tsx";
import PageLayout_96 from "./pages/teacher.create-test.pageLayout.tsx";
import Page_97 from "./pages/teacher.promo-codes.tsx";
import PageLayout_97 from "./pages/teacher.promo-codes.pageLayout.tsx";
import Page_98 from "./pages/teacher.test-series.tsx";
import PageLayout_98 from "./pages/teacher.test-series.pageLayout.tsx";
import Page_99 from "./pages/admin.reset-password.tsx";
import PageLayout_99 from "./pages/admin.reset-password.pageLayout.tsx";
import Page_100 from "./pages/student.certificates.tsx";
import PageLayout_100 from "./pages/student.certificates.pageLayout.tsx";
import Page_101 from "./pages/teacher.edit-profile.tsx";
import PageLayout_101 from "./pages/teacher.edit-profile.pageLayout.tsx";
import Page_102 from "./pages/teacher.subscription.tsx";
import PageLayout_102 from "./pages/teacher.subscription.pageLayout.tsx";
import Page_103 from "./pages/admin.content-reviews.tsx";
import PageLayout_103 from "./pages/admin.content-reviews.pageLayout.tsx";
import Page_104 from "./pages/admin.email-templates.tsx";
import PageLayout_104 from "./pages/admin.email-templates.pageLayout.tsx";
import Page_105 from "./pages/admin.forgot-password.tsx";
import PageLayout_105 from "./pages/admin.forgot-password.pageLayout.tsx";
import Page_106 from "./pages/sell.study-notes-pdfs.tsx";
import PageLayout_106 from "./pages/sell.study-notes-pdfs.pageLayout.tsx";
import Page_107 from "./pages/study-notes.$noteSlug.tsx";
import PageLayout_107 from "./pages/study-notes.$noteSlug.pageLayout.tsx";
import Page_108 from "./pages/teacher.dashboard-old.tsx";
import PageLayout_108 from "./pages/teacher.dashboard-old.pageLayout.tsx";
import Page_109 from "./pages/teacher.question-bank.tsx";
import PageLayout_109 from "./pages/teacher.question-bank.pageLayout.tsx";
import Page_110 from "./pages/admin.deleted-accounts.tsx";
import PageLayout_110 from "./pages/admin.deleted-accounts.pageLayout.tsx";
import Page_111 from "./pages/ai-mock-test-generator.tsx";
import PageLayout_111 from "./pages/ai-mock-test-generator.pageLayout.tsx";
import Page_112 from "./pages/exams.$examSlug.cutoff.tsx";
import PageLayout_112 from "./pages/exams.$examSlug.cutoff.pageLayout.tsx";
import Page_113 from "./pages/teacher.bundles.create.tsx";
import PageLayout_113 from "./pages/teacher.bundles.create.pageLayout.tsx";
import Page_114 from "./pages/teacher.courses.create.tsx";
import PageLayout_114 from "./pages/teacher.courses.create.pageLayout.tsx";
import Page_115 from "./pages/admin.teachers.earnings.tsx";
import PageLayout_115 from "./pages/admin.teachers.earnings.pageLayout.tsx";
import Page_116 from "./pages/exams.$examSlug.bundles.tsx";
import PageLayout_116 from "./pages/exams.$examSlug.bundles.pageLayout.tsx";
import Page_117 from "./pages/exams.$examSlug.courses.tsx";
import PageLayout_117 from "./pages/exams.$examSlug.courses.pageLayout.tsx";
import Page_118 from "./pages/live-portal.$liveTestId.tsx";
import PageLayout_118 from "./pages/live-portal.$liveTestId.pageLayout.tsx";
import Page_119 from "./pages/student.shop.$productId.tsx";
import PageLayout_119 from "./pages/student.shop.$productId.pageLayout.tsx";
import Page_120 from "./pages/teacher.products.create.tsx";
import PageLayout_120 from "./pages/teacher.products.create.pageLayout.tsx";
import Page_121 from "./pages/teachers.live-mock-test.tsx";
import PageLayout_121 from "./pages/teachers.live-mock-test.pageLayout.tsx";
import Page_122 from "./pages/admin.teachers.inquiries.tsx";
import PageLayout_122 from "./pages/admin.teachers.inquiries.pageLayout.tsx";
import Page_123 from "./pages/exams.$examSlug.syllabus.tsx";
import PageLayout_123 from "./pages/exams.$examSlug.syllabus.pageLayout.tsx";
import Page_124 from "./pages/teacher.create-live-test.tsx";
import PageLayout_124 from "./pages/teacher.create-live-test.pageLayout.tsx";
import Page_125 from "./pages/admin.contact-submissions.tsx";
import PageLayout_125 from "./pages/admin.contact-submissions.pageLayout.tsx";
import Page_126 from "./pages/news-and-events.$newsSlug.tsx";
import PageLayout_126 from "./pages/news-and-events.$newsSlug.pageLayout.tsx";
import Page_127 from "./pages/student.courses.$courseId.tsx";
import PageLayout_127 from "./pages/student.courses.$courseId.pageLayout.tsx";
import Page_128 from "./pages/teacher.test.$testId.edit.tsx";
import PageLayout_128 from "./pages/teacher.test.$testId.edit.pageLayout.tsx";
import Page_129 from "./pages/admin.exam-content.$examId.tsx";
import PageLayout_129 from "./pages/admin.exam-content.$examId.pageLayout.tsx";
import Page_130 from "./pages/admin.students.withdrawals.tsx";
import PageLayout_130 from "./pages/admin.students.withdrawals.pageLayout.tsx";
import Page_131 from "./pages/admin.teachers.withdrawals.tsx";
import PageLayout_131 from "./pages/admin.teachers.withdrawals.pageLayout.tsx";
import Page_132 from "./pages/compare.graphy-vs-testkart.tsx";
import PageLayout_132 from "./pages/compare.graphy-vs-testkart.pageLayout.tsx";
import Page_133 from "./pages/exams.$examSlug.mock-tests.tsx";
import PageLayout_133 from "./pages/exams.$examSlug.mock-tests.pageLayout.tsx";
import Page_134 from "./pages/mock-test.live.$liveTestId.tsx";
import PageLayout_134 from "./pages/mock-test.live.$liveTestId.pageLayout.tsx";
import Page_135 from "./pages/portal.$testItemId.results.tsx";
import PageLayout_135 from "./pages/portal.$testItemId.results.pageLayout.tsx";
import Page_136 from "./pages/admin.students.bank-details.tsx";
import PageLayout_136 from "./pages/admin.students.bank-details.pageLayout.tsx";
import Page_137 from "./pages/admin.teachers.bank-details.tsx";
import PageLayout_137 from "./pages/admin.teachers.bank-details.pageLayout.tsx";
import Page_138 from "./pages/certificates.$certificateId.tsx";
import PageLayout_138 from "./pages/certificates.$certificateId.pageLayout.tsx";
import Page_139 from "./pages/exams.$examSlug.eligibility.tsx";
import PageLayout_139 from "./pages/exams.$examSlug.eligibility.pageLayout.tsx";
import Page_140 from "./pages/exams.$examSlug.study-notes.tsx";
import PageLayout_140 from "./pages/exams.$examSlug.study-notes.pageLayout.tsx";
import Page_141 from "./pages/compare.learnyst-vs-testkart.tsx";
import PageLayout_141 from "./pages/compare.learnyst-vs-testkart.pageLayout.tsx";
import Page_142 from "./pages/compare.tagmango-vs-testkart.tsx";
import PageLayout_142 from "./pages/compare.tagmango-vs-testkart.pageLayout.tsx";
import Page_143 from "./pages/exams.$examSlug.exam-pattern.tsx";
import PageLayout_143 from "./pages/exams.$examSlug.exam-pattern.pageLayout.tsx";
import Page_144 from "./pages/teachers.sell-online-courses.tsx";
import PageLayout_144 from "./pages/teachers.sell-online-courses.pageLayout.tsx";
import Page_145 from "./pages/compare.classplus-vs-testkart.tsx";
import PageLayout_145 from "./pages/compare.classplus-vs-testkart.pageLayout.tsx";
import Page_146 from "./pages/student.tests.$enrolledTestId.tsx";
import PageLayout_146 from "./pages/student.tests.$enrolledTestId.pageLayout.tsx";
import Page_147 from "./pages/teacher.bundles.$bundleId.edit.tsx";
import PageLayout_147 from "./pages/teacher.bundles.$bundleId.edit.pageLayout.tsx";
import Page_148 from "./pages/teacher.courses.$courseId.edit.tsx";
import PageLayout_148 from "./pages/teacher.courses.$courseId.edit.pageLayout.tsx";
import Page_149 from "./pages/teacher.create-test.basic-info.tsx";
import PageLayout_149 from "./pages/teacher.create-test.basic-info.pageLayout.tsx";
import Page_150 from "./pages/teachers.sell-digital-products.tsx";
import PageLayout_150 from "./pages/teachers.sell-digital-products.pageLayout.tsx";
import Page_151 from "./pages/teacher.products.$productId.edit.tsx";
import PageLayout_151 from "./pages/teacher.products.$productId.edit.pageLayout.tsx";
import Page_152 from "./pages/teacher.create-test.$testId.review.tsx";
import PageLayout_152 from "./pages/teacher.create-test.$testId.review.pageLayout.tsx";
import Page_153 from "./pages/teacher.live-test.$liveTestId.edit.tsx";
import PageLayout_153 from "./pages/teacher.live-test.$liveTestId.edit.pageLayout.tsx";
import Page_154 from "./pages/teacher.create-test.$testId.test-items.tsx";
import PageLayout_154 from "./pages/teacher.create-test.$testId.test-items.pageLayout.tsx";
import Page_155 from "./pages/ugc-net-swmg-success-with-mukesh-goyal.tsx";
import PageLayout_155 from "./pages/ugc-net-swmg-success-with-mukesh-goyal.pageLayout.tsx";
import Page_156 from "./pages/teacher.live-test.$liveTestId.questions.tsx";
import PageLayout_156 from "./pages/teacher.live-test.$liveTestId.questions.pageLayout.tsx";
import Page_157 from "./pages/teacher.courses.$courseId.lessons.$lessonId.tsx";
import PageLayout_157 from "./pages/teacher.courses.$courseId.lessons.$lessonId.pageLayout.tsx";
import Page_158 from "./pages/ugc-net-swmg-success-with-mukesh-goyal.reviews.tsx";
import PageLayout_158 from "./pages/ugc-net-swmg-success-with-mukesh-goyal.reviews.pageLayout.tsx";
import Page_159 from "./pages/teacher.create-test.$testId.test-items.$itemId.preview.tsx";
import PageLayout_159 from "./pages/teacher.create-test.$testId.test-items.$itemId.preview.pageLayout.tsx";
import Page_160 from "./pages/teacher.create-test.$testId.test-items.$itemId.questions.tsx";
import PageLayout_160 from "./pages/teacher.create-test.$testId.test-items.$itemId.questions.pageLayout.tsx";
import Page_161 from "./pages/teacher.create-test.$testId.test-items.$itemId.questions.new.tsx";
import PageLayout_161 from "./pages/teacher.create-test.$testId.test-items.$itemId.questions.new.pageLayout.tsx";
import Page_162 from "./pages/ugc-net-swmg-success-with-mukesh-goyal.environmental-science.tsx";
import PageLayout_162 from "./pages/ugc-net-swmg-success-with-mukesh-goyal.environmental-science.pageLayout.tsx";
import Page_163 from "./pages/teacher.create-test.$testId.test-items.$itemId.questions.$questionId.edit.tsx";
import PageLayout_163 from "./pages/teacher.create-test.$testId.test-items.$itemId.questions.$questionId.edit.pageLayout.tsx";

if (!window.requestIdleCallback) {
  window.requestIdleCallback = (cb) => {
    setTimeout(cb, 1);
  };
}

import "./base.css";

const fileNameToRoute = new Map([["./pages/$.tsx","/*"],["./pages/blog.tsx","/blog"],["./pages/cart.tsx","/cart"],["./pages/help.tsx","/help"],["./pages/sell.tsx","/sell"],["./pages/about.tsx","/about"],["./pages/admin.tsx","/admin"],["./pages/exams.tsx","/exams"],["./pages/login.tsx","/login"],["./pages/terms.tsx","/terms"],["./pages/_index.tsx","/"],["./pages/course.tsx","/course"],["./pages/refund.tsx","/refund"],["./pages/search.tsx","/search"],["./pages/signup.tsx","/signup"],["./pages/bundles.tsx","/bundles"],["./pages/careers.tsx","/careers"],["./pages/contact.tsx","/contact"],["./pages/privacy.tsx","/privacy"],["./pages/teachers.tsx","/teachers"],["./pages/mock-test.tsx","/mock-test"],["./pages/admin.blog.tsx","/admin/blog"],["./pages/admin.news.tsx","/admin/news"],["./pages/admin.login.tsx","/admin/login"],["./pages/admin.notes.tsx","/admin/notes"],["./pages/admin.sales.tsx","/admin/sales"],["./pages/study-notes.tsx","/study-notes"],["./pages/sell.courses.tsx","/sell/courses"],["./pages/student.live.tsx","/student/live"],["./pages/student.shop.tsx","/student/shop"],["./pages/admin.bundles.tsx","/admin/bundles"],["./pages/admin.careers.tsx","/admin/careers"],["./pages/admin.content.tsx","/admin/content"],["./pages/admin.courses.tsx","/admin/courses"],["./pages/admin.finance.tsx","/admin/finance"],["./pages/admin.profile.tsx","/admin/profile"],["./pages/admin.support.tsx","/admin/support"],["./pages/app-turnstile.tsx","/app-turnstile"],["./pages/close-account.tsx","/close-account"],["./pages/student.tests.tsx","/student/tests"],["./pages/teacher.login.tsx","/teacher/login"],["./pages/teacher.trash.tsx","/teacher/trash"],["./pages/verify-mobile.tsx","/verify-mobile"],["./pages/admin.ai-usage.tsx","/admin/ai-usage"],["./pages/admin.api-docs.tsx","/admin/api-docs"],["./pages/admin.settings.tsx","/admin/settings"],["./pages/admin.students.tsx","/admin/students"],["./pages/admin.teachers.tsx","/admin/teachers"],["./pages/blog.$blogSlug.tsx","/blog/:blogSlug"],["./pages/mock-test.live.tsx","/mock-test/live"],["./pages/order.$orderId.tsx","/order/:orderId"],["./pages/sell.mock-test.tsx","/sell/mock-test"],["./pages/student.orders.tsx","/student/orders"],["./pages/student.wallet.tsx","/student/wallet"],["./pages/teacher.signup.tsx","/teacher/signup"],["./pages/admin.catalogue.tsx","/admin/catalogue"],["./pages/admin.dashboard.tsx","/admin/dashboard"],["./pages/exams.$examSlug.tsx","/exams/:examSlug"],["./pages/news-and-events.tsx","/news-and-events"],["./pages/student.courses.tsx","/student/courses"],["./pages/student.profile.tsx","/student/profile"],["./pages/teacher.bundles.tsx","/teacher/bundles"],["./pages/teacher.courses.tsx","/teacher/courses"],["./pages/teacher.reports.tsx","/teacher/reports"],["./pages/teacher.reviews.tsx","/teacher/reviews"],["./pages/teacher.support.tsx","/teacher/support"],["./pages/admin.blog.e.$id.tsx","/admin/blog/e/:id"],["./pages/admin.live-tests.tsx","/admin/live-tests"],["./pages/admin.news.e.$id.tsx","/admin/news/e/:id"],["./pages/payment.callback.tsx","/payment/callback"],["./pages/teacher.products.tsx","/teacher/products"],["./pages/teacher.settings.tsx","/teacher/settings"],["./pages/teacher.students.tsx","/teacher/students"],["./pages/admin.test-series.tsx","/admin/test-series"],["./pages/ai-quiz-generator.tsx","/ai-quiz-generator"],["./pages/courses.$courseId.tsx","/courses/:courseId"],["./pages/help.$articleSlug.tsx","/help/:articleSlug"],["./pages/student.dashboard.tsx","/student/dashboard"],["./pages/teacher.dashboard.tsx","/teacher/dashboard"],["./pages/admin.ai-questions.tsx","/admin/ai-questions"],["./pages/admin.exam-content.tsx","/admin/exam-content"],["./pages/admin.static-pages.tsx","/admin/static-pages"],["./pages/admin.transactions.tsx","/admin/transactions"],["./pages/course.$courseSlug.tsx","/course/:courseSlug"],["./pages/portal.$testItemId.tsx","/portal/:testItemId"],["./pages/teacher.live-tests.tsx","/teacher/live-tests"],["./pages/teacher.onboarding.tsx","/teacher/onboarding"],["./pages/admin.blog.category.tsx","/admin/blog/category"],["./pages/admin.blog.comments.tsx","/admin/blog/comments"],["./pages/admin.dashboard.old.tsx","/admin/dashboard/old"],["./pages/admin.subscriptions.tsx","/admin/subscriptions"],["./pages/bundles.$bundleSlug.tsx","/bundles/:bundleSlug"],["./pages/careers.$careerSlug.tsx","/careers/:careerSlug"],["./pages/expert.$teacherSlug.tsx","/expert/:teacherSlug"],["./pages/mock-test.$testSlug.tsx","/mock-test/:testSlug"],["./pages/sell.host-live-exam.tsx","/sell/host-live-exam"],["./pages/teacher.create-test.tsx","/teacher/create-test"],["./pages/teacher.promo-codes.tsx","/teacher/promo-codes"],["./pages/teacher.test-series.tsx","/teacher/test-series"],["./pages/admin.reset-password.tsx","/admin/reset-password"],["./pages/student.certificates.tsx","/student/certificates"],["./pages/teacher.edit-profile.tsx","/teacher/edit-profile"],["./pages/teacher.subscription.tsx","/teacher/subscription"],["./pages/admin.content-reviews.tsx","/admin/content-reviews"],["./pages/admin.email-templates.tsx","/admin/email-templates"],["./pages/admin.forgot-password.tsx","/admin/forgot-password"],["./pages/sell.study-notes-pdfs.tsx","/sell/study-notes-pdfs"],["./pages/study-notes.$noteSlug.tsx","/study-notes/:noteSlug"],["./pages/teacher.dashboard-old.tsx","/teacher/dashboard-old"],["./pages/teacher.question-bank.tsx","/teacher/question-bank"],["./pages/admin.deleted-accounts.tsx","/admin/deleted-accounts"],["./pages/ai-mock-test-generator.tsx","/ai-mock-test-generator"],["./pages/exams.$examSlug.cutoff.tsx","/exams/:examSlug/cutoff"],["./pages/teacher.bundles.create.tsx","/teacher/bundles/create"],["./pages/teacher.courses.create.tsx","/teacher/courses/create"],["./pages/admin.teachers.earnings.tsx","/admin/teachers/earnings"],["./pages/exams.$examSlug.bundles.tsx","/exams/:examSlug/bundles"],["./pages/exams.$examSlug.courses.tsx","/exams/:examSlug/courses"],["./pages/live-portal.$liveTestId.tsx","/live-portal/:liveTestId"],["./pages/student.shop.$productId.tsx","/student/shop/:productId"],["./pages/teacher.products.create.tsx","/teacher/products/create"],["./pages/teachers.live-mock-test.tsx","/teachers/live-mock-test"],["./pages/admin.teachers.inquiries.tsx","/admin/teachers/inquiries"],["./pages/exams.$examSlug.syllabus.tsx","/exams/:examSlug/syllabus"],["./pages/teacher.create-live-test.tsx","/teacher/create-live-test"],["./pages/admin.contact-submissions.tsx","/admin/contact-submissions"],["./pages/news-and-events.$newsSlug.tsx","/news-and-events/:newsSlug"],["./pages/student.courses.$courseId.tsx","/student/courses/:courseId"],["./pages/teacher.test.$testId.edit.tsx","/teacher/test/:testId/edit"],["./pages/admin.exam-content.$examId.tsx","/admin/exam-content/:examId"],["./pages/admin.students.withdrawals.tsx","/admin/students/withdrawals"],["./pages/admin.teachers.withdrawals.tsx","/admin/teachers/withdrawals"],["./pages/compare.graphy-vs-testkart.tsx","/compare/graphy-vs-testkart"],["./pages/exams.$examSlug.mock-tests.tsx","/exams/:examSlug/mock-tests"],["./pages/mock-test.live.$liveTestId.tsx","/mock-test/live/:liveTestId"],["./pages/portal.$testItemId.results.tsx","/portal/:testItemId/results"],["./pages/admin.students.bank-details.tsx","/admin/students/bank-details"],["./pages/admin.teachers.bank-details.tsx","/admin/teachers/bank-details"],["./pages/certificates.$certificateId.tsx","/certificates/:certificateId"],["./pages/exams.$examSlug.eligibility.tsx","/exams/:examSlug/eligibility"],["./pages/exams.$examSlug.study-notes.tsx","/exams/:examSlug/study-notes"],["./pages/compare.learnyst-vs-testkart.tsx","/compare/learnyst-vs-testkart"],["./pages/compare.tagmango-vs-testkart.tsx","/compare/tagmango-vs-testkart"],["./pages/exams.$examSlug.exam-pattern.tsx","/exams/:examSlug/exam-pattern"],["./pages/teachers.sell-online-courses.tsx","/teachers/sell-online-courses"],["./pages/compare.classplus-vs-testkart.tsx","/compare/classplus-vs-testkart"],["./pages/student.tests.$enrolledTestId.tsx","/student/tests/:enrolledTestId"],["./pages/teacher.bundles.$bundleId.edit.tsx","/teacher/bundles/:bundleId/edit"],["./pages/teacher.courses.$courseId.edit.tsx","/teacher/courses/:courseId/edit"],["./pages/teacher.create-test.basic-info.tsx","/teacher/create-test/basic-info"],["./pages/teachers.sell-digital-products.tsx","/teachers/sell-digital-products"],["./pages/teacher.products.$productId.edit.tsx","/teacher/products/:productId/edit"],["./pages/teacher.create-test.$testId.review.tsx","/teacher/create-test/:testId/review"],["./pages/teacher.live-test.$liveTestId.edit.tsx","/teacher/live-test/:liveTestId/edit"],["./pages/teacher.create-test.$testId.test-items.tsx","/teacher/create-test/:testId/test-items"],["./pages/ugc-net-swmg-success-with-mukesh-goyal.tsx","/ugc-net-swmg-success-with-mukesh-goyal"],["./pages/teacher.live-test.$liveTestId.questions.tsx","/teacher/live-test/:liveTestId/questions"],["./pages/teacher.courses.$courseId.lessons.$lessonId.tsx","/teacher/courses/:courseId/lessons/:lessonId"],["./pages/ugc-net-swmg-success-with-mukesh-goyal.reviews.tsx","/ugc-net-swmg-success-with-mukesh-goyal/reviews"],["./pages/teacher.create-test.$testId.test-items.$itemId.preview.tsx","/teacher/create-test/:testId/test-items/:itemId/preview"],["./pages/teacher.create-test.$testId.test-items.$itemId.questions.tsx","/teacher/create-test/:testId/test-items/:itemId/questions"],["./pages/teacher.create-test.$testId.test-items.$itemId.questions.new.tsx","/teacher/create-test/:testId/test-items/:itemId/questions/new"],["./pages/ugc-net-swmg-success-with-mukesh-goyal.environmental-science.tsx","/ugc-net-swmg-success-with-mukesh-goyal/environmental-science"],["./pages/teacher.create-test.$testId.test-items.$itemId.questions.$questionId.edit.tsx","/teacher/create-test/:testId/test-items/:itemId/questions/:questionId/edit"]]);
const fileNameToComponent = new Map([
    ["./pages/$.tsx", Page_0],
["./pages/blog.tsx", Page_1],
["./pages/cart.tsx", Page_2],
["./pages/help.tsx", Page_3],
["./pages/sell.tsx", Page_4],
["./pages/about.tsx", Page_5],
["./pages/admin.tsx", Page_6],
["./pages/exams.tsx", Page_7],
["./pages/login.tsx", Page_8],
["./pages/terms.tsx", Page_9],
["./pages/_index.tsx", Page_10],
["./pages/course.tsx", Page_11],
["./pages/refund.tsx", Page_12],
["./pages/search.tsx", Page_13],
["./pages/signup.tsx", Page_14],
["./pages/bundles.tsx", Page_15],
["./pages/careers.tsx", Page_16],
["./pages/contact.tsx", Page_17],
["./pages/privacy.tsx", Page_18],
["./pages/teachers.tsx", Page_19],
["./pages/mock-test.tsx", Page_20],
["./pages/admin.blog.tsx", Page_21],
["./pages/admin.news.tsx", Page_22],
["./pages/admin.login.tsx", Page_23],
["./pages/admin.notes.tsx", Page_24],
["./pages/admin.sales.tsx", Page_25],
["./pages/study-notes.tsx", Page_26],
["./pages/sell.courses.tsx", Page_27],
["./pages/student.live.tsx", Page_28],
["./pages/student.shop.tsx", Page_29],
["./pages/admin.bundles.tsx", Page_30],
["./pages/admin.careers.tsx", Page_31],
["./pages/admin.content.tsx", Page_32],
["./pages/admin.courses.tsx", Page_33],
["./pages/admin.finance.tsx", Page_34],
["./pages/admin.profile.tsx", Page_35],
["./pages/admin.support.tsx", Page_36],
["./pages/app-turnstile.tsx", Page_37],
["./pages/close-account.tsx", Page_38],
["./pages/student.tests.tsx", Page_39],
["./pages/teacher.login.tsx", Page_40],
["./pages/teacher.trash.tsx", Page_41],
["./pages/verify-mobile.tsx", Page_42],
["./pages/admin.ai-usage.tsx", Page_43],
["./pages/admin.api-docs.tsx", Page_44],
["./pages/admin.settings.tsx", Page_45],
["./pages/admin.students.tsx", Page_46],
["./pages/admin.teachers.tsx", Page_47],
["./pages/blog.$blogSlug.tsx", Page_48],
["./pages/mock-test.live.tsx", Page_49],
["./pages/order.$orderId.tsx", Page_50],
["./pages/sell.mock-test.tsx", Page_51],
["./pages/student.orders.tsx", Page_52],
["./pages/student.wallet.tsx", Page_53],
["./pages/teacher.signup.tsx", Page_54],
["./pages/admin.catalogue.tsx", Page_55],
["./pages/admin.dashboard.tsx", Page_56],
["./pages/exams.$examSlug.tsx", Page_57],
["./pages/news-and-events.tsx", Page_58],
["./pages/student.courses.tsx", Page_59],
["./pages/student.profile.tsx", Page_60],
["./pages/teacher.bundles.tsx", Page_61],
["./pages/teacher.courses.tsx", Page_62],
["./pages/teacher.reports.tsx", Page_63],
["./pages/teacher.reviews.tsx", Page_64],
["./pages/teacher.support.tsx", Page_65],
["./pages/admin.blog.e.$id.tsx", Page_66],
["./pages/admin.live-tests.tsx", Page_67],
["./pages/admin.news.e.$id.tsx", Page_68],
["./pages/payment.callback.tsx", Page_69],
["./pages/teacher.products.tsx", Page_70],
["./pages/teacher.settings.tsx", Page_71],
["./pages/teacher.students.tsx", Page_72],
["./pages/admin.test-series.tsx", Page_73],
["./pages/ai-quiz-generator.tsx", Page_74],
["./pages/courses.$courseId.tsx", Page_75],
["./pages/help.$articleSlug.tsx", Page_76],
["./pages/student.dashboard.tsx", Page_77],
["./pages/teacher.dashboard.tsx", Page_78],
["./pages/admin.ai-questions.tsx", Page_79],
["./pages/admin.exam-content.tsx", Page_80],
["./pages/admin.static-pages.tsx", Page_81],
["./pages/admin.transactions.tsx", Page_82],
["./pages/course.$courseSlug.tsx", Page_83],
["./pages/portal.$testItemId.tsx", Page_84],
["./pages/teacher.live-tests.tsx", Page_85],
["./pages/teacher.onboarding.tsx", Page_86],
["./pages/admin.blog.category.tsx", Page_87],
["./pages/admin.blog.comments.tsx", Page_88],
["./pages/admin.dashboard.old.tsx", Page_89],
["./pages/admin.subscriptions.tsx", Page_90],
["./pages/bundles.$bundleSlug.tsx", Page_91],
["./pages/careers.$careerSlug.tsx", Page_92],
["./pages/expert.$teacherSlug.tsx", Page_93],
["./pages/mock-test.$testSlug.tsx", Page_94],
["./pages/sell.host-live-exam.tsx", Page_95],
["./pages/teacher.create-test.tsx", Page_96],
["./pages/teacher.promo-codes.tsx", Page_97],
["./pages/teacher.test-series.tsx", Page_98],
["./pages/admin.reset-password.tsx", Page_99],
["./pages/student.certificates.tsx", Page_100],
["./pages/teacher.edit-profile.tsx", Page_101],
["./pages/teacher.subscription.tsx", Page_102],
["./pages/admin.content-reviews.tsx", Page_103],
["./pages/admin.email-templates.tsx", Page_104],
["./pages/admin.forgot-password.tsx", Page_105],
["./pages/sell.study-notes-pdfs.tsx", Page_106],
["./pages/study-notes.$noteSlug.tsx", Page_107],
["./pages/teacher.dashboard-old.tsx", Page_108],
["./pages/teacher.question-bank.tsx", Page_109],
["./pages/admin.deleted-accounts.tsx", Page_110],
["./pages/ai-mock-test-generator.tsx", Page_111],
["./pages/exams.$examSlug.cutoff.tsx", Page_112],
["./pages/teacher.bundles.create.tsx", Page_113],
["./pages/teacher.courses.create.tsx", Page_114],
["./pages/admin.teachers.earnings.tsx", Page_115],
["./pages/exams.$examSlug.bundles.tsx", Page_116],
["./pages/exams.$examSlug.courses.tsx", Page_117],
["./pages/live-portal.$liveTestId.tsx", Page_118],
["./pages/student.shop.$productId.tsx", Page_119],
["./pages/teacher.products.create.tsx", Page_120],
["./pages/teachers.live-mock-test.tsx", Page_121],
["./pages/admin.teachers.inquiries.tsx", Page_122],
["./pages/exams.$examSlug.syllabus.tsx", Page_123],
["./pages/teacher.create-live-test.tsx", Page_124],
["./pages/admin.contact-submissions.tsx", Page_125],
["./pages/news-and-events.$newsSlug.tsx", Page_126],
["./pages/student.courses.$courseId.tsx", Page_127],
["./pages/teacher.test.$testId.edit.tsx", Page_128],
["./pages/admin.exam-content.$examId.tsx", Page_129],
["./pages/admin.students.withdrawals.tsx", Page_130],
["./pages/admin.teachers.withdrawals.tsx", Page_131],
["./pages/compare.graphy-vs-testkart.tsx", Page_132],
["./pages/exams.$examSlug.mock-tests.tsx", Page_133],
["./pages/mock-test.live.$liveTestId.tsx", Page_134],
["./pages/portal.$testItemId.results.tsx", Page_135],
["./pages/admin.students.bank-details.tsx", Page_136],
["./pages/admin.teachers.bank-details.tsx", Page_137],
["./pages/certificates.$certificateId.tsx", Page_138],
["./pages/exams.$examSlug.eligibility.tsx", Page_139],
["./pages/exams.$examSlug.study-notes.tsx", Page_140],
["./pages/compare.learnyst-vs-testkart.tsx", Page_141],
["./pages/compare.tagmango-vs-testkart.tsx", Page_142],
["./pages/exams.$examSlug.exam-pattern.tsx", Page_143],
["./pages/teachers.sell-online-courses.tsx", Page_144],
["./pages/compare.classplus-vs-testkart.tsx", Page_145],
["./pages/student.tests.$enrolledTestId.tsx", Page_146],
["./pages/teacher.bundles.$bundleId.edit.tsx", Page_147],
["./pages/teacher.courses.$courseId.edit.tsx", Page_148],
["./pages/teacher.create-test.basic-info.tsx", Page_149],
["./pages/teachers.sell-digital-products.tsx", Page_150],
["./pages/teacher.products.$productId.edit.tsx", Page_151],
["./pages/teacher.create-test.$testId.review.tsx", Page_152],
["./pages/teacher.live-test.$liveTestId.edit.tsx", Page_153],
["./pages/teacher.create-test.$testId.test-items.tsx", Page_154],
["./pages/ugc-net-swmg-success-with-mukesh-goyal.tsx", Page_155],
["./pages/teacher.live-test.$liveTestId.questions.tsx", Page_156],
["./pages/teacher.courses.$courseId.lessons.$lessonId.tsx", Page_157],
["./pages/ugc-net-swmg-success-with-mukesh-goyal.reviews.tsx", Page_158],
["./pages/teacher.create-test.$testId.test-items.$itemId.preview.tsx", Page_159],
["./pages/teacher.create-test.$testId.test-items.$itemId.questions.tsx", Page_160],
["./pages/teacher.create-test.$testId.test-items.$itemId.questions.new.tsx", Page_161],
["./pages/ugc-net-swmg-success-with-mukesh-goyal.environmental-science.tsx", Page_162],
["./pages/teacher.create-test.$testId.test-items.$itemId.questions.$questionId.edit.tsx", Page_163],
  ]);

function makePageRoute(filename: string) {
  const Component = fileNameToComponent.get(filename);
  return <Component />;
}

function toElement({
  trie,
  fileNameToRoute,
  makePageRoute,
}: {
  trie: LayoutTrie;
  fileNameToRoute: Map<string, string>;
  makePageRoute: (filename: string) => React.ReactNode;
}) {
  return [
    ...trie.topLevel.map((filename) => (
      <Route
        key={fileNameToRoute.get(filename)}
        path={fileNameToRoute.get(filename)}
        element={makePageRoute(filename)}
      />
    )),
    ...Array.from(trie.trie.entries()).map(([Component, child], index) => (
      <Route
        key={index}
        element={
          <Component>
            <Outlet />
          </Component>
        }
      >
        {toElement({ trie: child, fileNameToRoute, makePageRoute })}
      </Route>
    )),
  ];
}

type LayoutTrieNode = Map<
  React.ComponentType<{ children: React.ReactNode }>,
  LayoutTrie
>;
type LayoutTrie = { topLevel: string[]; trie: LayoutTrieNode };
function buildLayoutTrie(layouts: {
  [fileName: string]: React.ComponentType<{ children: React.ReactNode }>[];
}): LayoutTrie {
  const result: LayoutTrie = { topLevel: [], trie: new Map() };
  Object.entries(layouts).forEach(([fileName, components]) => {
    let cur: LayoutTrie = result;
    for (const component of components) {
      if (!cur.trie.has(component)) {
        cur.trie.set(component, {
          topLevel: [],
          trie: new Map(),
        });
      }
      cur = cur.trie.get(component)!;
    }
    cur.topLevel.push(fileName);
  });
  return result;
}

function NotFound() {
  return (
    <div>
      <h1>Not Found</h1>
      <p>The page you are looking for does not exist.</p>
      <p>Go back to the <a href="/" style={{ color: 'blue' }}>home page</a>.</p>
    </div>
  );
}

import { useLocation, useNavigationType } from "react-router-dom";

export default function ScrollManager() {
  const { pathname, search, hash } = useLocation();
  const navType = useNavigationType(); // "PUSH" | "REPLACE" | "POP"

  useEffect(() => {
    // Back/forward: keep browser-like behavior
    if (navType === "POP") return;

    // Hash links: let the browser scroll to the anchor
    if (hash) return;

    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname, search, hash, navType]);

  return null;
}

export function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: false, v7_relativeSplatPath: false }}>
      <ScrollManager />
      <GlobalContextProviders>
        <Routes>
          {toElement({ trie: buildLayoutTrie({
"./pages/$.tsx": PageLayout_0,
"./pages/blog.tsx": PageLayout_1,
"./pages/cart.tsx": PageLayout_2,
"./pages/help.tsx": PageLayout_3,
"./pages/sell.tsx": PageLayout_4,
"./pages/about.tsx": PageLayout_5,
"./pages/admin.tsx": PageLayout_6,
"./pages/exams.tsx": PageLayout_7,
"./pages/login.tsx": PageLayout_8,
"./pages/terms.tsx": PageLayout_9,
"./pages/_index.tsx": PageLayout_10,
"./pages/course.tsx": PageLayout_11,
"./pages/refund.tsx": PageLayout_12,
"./pages/search.tsx": PageLayout_13,
"./pages/signup.tsx": PageLayout_14,
"./pages/bundles.tsx": PageLayout_15,
"./pages/careers.tsx": PageLayout_16,
"./pages/contact.tsx": PageLayout_17,
"./pages/privacy.tsx": PageLayout_18,
"./pages/teachers.tsx": PageLayout_19,
"./pages/mock-test.tsx": PageLayout_20,
"./pages/admin.blog.tsx": PageLayout_21,
"./pages/admin.news.tsx": PageLayout_22,
"./pages/admin.login.tsx": PageLayout_23,
"./pages/admin.notes.tsx": PageLayout_24,
"./pages/admin.sales.tsx": PageLayout_25,
"./pages/study-notes.tsx": PageLayout_26,
"./pages/sell.courses.tsx": PageLayout_27,
"./pages/student.live.tsx": PageLayout_28,
"./pages/student.shop.tsx": PageLayout_29,
"./pages/admin.bundles.tsx": PageLayout_30,
"./pages/admin.careers.tsx": PageLayout_31,
"./pages/admin.content.tsx": PageLayout_32,
"./pages/admin.courses.tsx": PageLayout_33,
"./pages/admin.finance.tsx": PageLayout_34,
"./pages/admin.profile.tsx": PageLayout_35,
"./pages/admin.support.tsx": PageLayout_36,
"./pages/app-turnstile.tsx": PageLayout_37,
"./pages/close-account.tsx": PageLayout_38,
"./pages/student.tests.tsx": PageLayout_39,
"./pages/teacher.login.tsx": PageLayout_40,
"./pages/teacher.trash.tsx": PageLayout_41,
"./pages/verify-mobile.tsx": PageLayout_42,
"./pages/admin.ai-usage.tsx": PageLayout_43,
"./pages/admin.api-docs.tsx": PageLayout_44,
"./pages/admin.settings.tsx": PageLayout_45,
"./pages/admin.students.tsx": PageLayout_46,
"./pages/admin.teachers.tsx": PageLayout_47,
"./pages/blog.$blogSlug.tsx": PageLayout_48,
"./pages/mock-test.live.tsx": PageLayout_49,
"./pages/order.$orderId.tsx": PageLayout_50,
"./pages/sell.mock-test.tsx": PageLayout_51,
"./pages/student.orders.tsx": PageLayout_52,
"./pages/student.wallet.tsx": PageLayout_53,
"./pages/teacher.signup.tsx": PageLayout_54,
"./pages/admin.catalogue.tsx": PageLayout_55,
"./pages/admin.dashboard.tsx": PageLayout_56,
"./pages/exams.$examSlug.tsx": PageLayout_57,
"./pages/news-and-events.tsx": PageLayout_58,
"./pages/student.courses.tsx": PageLayout_59,
"./pages/student.profile.tsx": PageLayout_60,
"./pages/teacher.bundles.tsx": PageLayout_61,
"./pages/teacher.courses.tsx": PageLayout_62,
"./pages/teacher.reports.tsx": PageLayout_63,
"./pages/teacher.reviews.tsx": PageLayout_64,
"./pages/teacher.support.tsx": PageLayout_65,
"./pages/admin.blog.e.$id.tsx": PageLayout_66,
"./pages/admin.live-tests.tsx": PageLayout_67,
"./pages/admin.news.e.$id.tsx": PageLayout_68,
"./pages/payment.callback.tsx": PageLayout_69,
"./pages/teacher.products.tsx": PageLayout_70,
"./pages/teacher.settings.tsx": PageLayout_71,
"./pages/teacher.students.tsx": PageLayout_72,
"./pages/admin.test-series.tsx": PageLayout_73,
"./pages/ai-quiz-generator.tsx": PageLayout_74,
"./pages/courses.$courseId.tsx": PageLayout_75,
"./pages/help.$articleSlug.tsx": PageLayout_76,
"./pages/student.dashboard.tsx": PageLayout_77,
"./pages/teacher.dashboard.tsx": PageLayout_78,
"./pages/admin.ai-questions.tsx": PageLayout_79,
"./pages/admin.exam-content.tsx": PageLayout_80,
"./pages/admin.static-pages.tsx": PageLayout_81,
"./pages/admin.transactions.tsx": PageLayout_82,
"./pages/course.$courseSlug.tsx": PageLayout_83,
"./pages/portal.$testItemId.tsx": PageLayout_84,
"./pages/teacher.live-tests.tsx": PageLayout_85,
"./pages/teacher.onboarding.tsx": PageLayout_86,
"./pages/admin.blog.category.tsx": PageLayout_87,
"./pages/admin.blog.comments.tsx": PageLayout_88,
"./pages/admin.dashboard.old.tsx": PageLayout_89,
"./pages/admin.subscriptions.tsx": PageLayout_90,
"./pages/bundles.$bundleSlug.tsx": PageLayout_91,
"./pages/careers.$careerSlug.tsx": PageLayout_92,
"./pages/expert.$teacherSlug.tsx": PageLayout_93,
"./pages/mock-test.$testSlug.tsx": PageLayout_94,
"./pages/sell.host-live-exam.tsx": PageLayout_95,
"./pages/teacher.create-test.tsx": PageLayout_96,
"./pages/teacher.promo-codes.tsx": PageLayout_97,
"./pages/teacher.test-series.tsx": PageLayout_98,
"./pages/admin.reset-password.tsx": PageLayout_99,
"./pages/student.certificates.tsx": PageLayout_100,
"./pages/teacher.edit-profile.tsx": PageLayout_101,
"./pages/teacher.subscription.tsx": PageLayout_102,
"./pages/admin.content-reviews.tsx": PageLayout_103,
"./pages/admin.email-templates.tsx": PageLayout_104,
"./pages/admin.forgot-password.tsx": PageLayout_105,
"./pages/sell.study-notes-pdfs.tsx": PageLayout_106,
"./pages/study-notes.$noteSlug.tsx": PageLayout_107,
"./pages/teacher.dashboard-old.tsx": PageLayout_108,
"./pages/teacher.question-bank.tsx": PageLayout_109,
"./pages/admin.deleted-accounts.tsx": PageLayout_110,
"./pages/ai-mock-test-generator.tsx": PageLayout_111,
"./pages/exams.$examSlug.cutoff.tsx": PageLayout_112,
"./pages/teacher.bundles.create.tsx": PageLayout_113,
"./pages/teacher.courses.create.tsx": PageLayout_114,
"./pages/admin.teachers.earnings.tsx": PageLayout_115,
"./pages/exams.$examSlug.bundles.tsx": PageLayout_116,
"./pages/exams.$examSlug.courses.tsx": PageLayout_117,
"./pages/live-portal.$liveTestId.tsx": PageLayout_118,
"./pages/student.shop.$productId.tsx": PageLayout_119,
"./pages/teacher.products.create.tsx": PageLayout_120,
"./pages/teachers.live-mock-test.tsx": PageLayout_121,
"./pages/admin.teachers.inquiries.tsx": PageLayout_122,
"./pages/exams.$examSlug.syllabus.tsx": PageLayout_123,
"./pages/teacher.create-live-test.tsx": PageLayout_124,
"./pages/admin.contact-submissions.tsx": PageLayout_125,
"./pages/news-and-events.$newsSlug.tsx": PageLayout_126,
"./pages/student.courses.$courseId.tsx": PageLayout_127,
"./pages/teacher.test.$testId.edit.tsx": PageLayout_128,
"./pages/admin.exam-content.$examId.tsx": PageLayout_129,
"./pages/admin.students.withdrawals.tsx": PageLayout_130,
"./pages/admin.teachers.withdrawals.tsx": PageLayout_131,
"./pages/compare.graphy-vs-testkart.tsx": PageLayout_132,
"./pages/exams.$examSlug.mock-tests.tsx": PageLayout_133,
"./pages/mock-test.live.$liveTestId.tsx": PageLayout_134,
"./pages/portal.$testItemId.results.tsx": PageLayout_135,
"./pages/admin.students.bank-details.tsx": PageLayout_136,
"./pages/admin.teachers.bank-details.tsx": PageLayout_137,
"./pages/certificates.$certificateId.tsx": PageLayout_138,
"./pages/exams.$examSlug.eligibility.tsx": PageLayout_139,
"./pages/exams.$examSlug.study-notes.tsx": PageLayout_140,
"./pages/compare.learnyst-vs-testkart.tsx": PageLayout_141,
"./pages/compare.tagmango-vs-testkart.tsx": PageLayout_142,
"./pages/exams.$examSlug.exam-pattern.tsx": PageLayout_143,
"./pages/teachers.sell-online-courses.tsx": PageLayout_144,
"./pages/compare.classplus-vs-testkart.tsx": PageLayout_145,
"./pages/student.tests.$enrolledTestId.tsx": PageLayout_146,
"./pages/teacher.bundles.$bundleId.edit.tsx": PageLayout_147,
"./pages/teacher.courses.$courseId.edit.tsx": PageLayout_148,
"./pages/teacher.create-test.basic-info.tsx": PageLayout_149,
"./pages/teachers.sell-digital-products.tsx": PageLayout_150,
"./pages/teacher.products.$productId.edit.tsx": PageLayout_151,
"./pages/teacher.create-test.$testId.review.tsx": PageLayout_152,
"./pages/teacher.live-test.$liveTestId.edit.tsx": PageLayout_153,
"./pages/teacher.create-test.$testId.test-items.tsx": PageLayout_154,
"./pages/ugc-net-swmg-success-with-mukesh-goyal.tsx": PageLayout_155,
"./pages/teacher.live-test.$liveTestId.questions.tsx": PageLayout_156,
"./pages/teacher.courses.$courseId.lessons.$lessonId.tsx": PageLayout_157,
"./pages/ugc-net-swmg-success-with-mukesh-goyal.reviews.tsx": PageLayout_158,
"./pages/teacher.create-test.$testId.test-items.$itemId.preview.tsx": PageLayout_159,
"./pages/teacher.create-test.$testId.test-items.$itemId.questions.tsx": PageLayout_160,
"./pages/teacher.create-test.$testId.test-items.$itemId.questions.new.tsx": PageLayout_161,
"./pages/ugc-net-swmg-success-with-mukesh-goyal.environmental-science.tsx": PageLayout_162,
"./pages/teacher.create-test.$testId.test-items.$itemId.questions.$questionId.edit.tsx": PageLayout_163,
}), fileNameToRoute, makePageRoute })} 
          <Route path="*" element={<NotFound />} />
        </Routes>
      </GlobalContextProviders>
    </BrowserRouter>
  );
}
