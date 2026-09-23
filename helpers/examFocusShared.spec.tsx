import { isExamFocusPromptDue } from "./examFocusShared";

describe("isExamFocusPromptDue", () => {
  const base = {
    user: { role: "student" as const, onboardingCompleted: false },
    focusCount: 0,
    impersonated: false,
  };

  it("asks a student with no focus", () => {
    expect(isExamFocusPromptDue(base)).toBe(true);
  });

  it("stops asking once a focus exists", () => {
    expect(isExamFocusPromptDue({ ...base, focusCount: 2 })).toBe(false);
  });

  it("never asks an admin impersonating", () => {
    expect(isExamFocusPromptDue({ ...base, impersonated: true })).toBe(false);
  });

  it("asks an onboarded academy owner", () => {
    expect(
      isExamFocusPromptDue({ ...base, user: { role: "teacher", teacherRole: "owner", onboardingCompleted: true } })
    ).toBe(true);
  });

  it("leaves teachers mid-onboarding and team managers alone", () => {
    expect(
      isExamFocusPromptDue({ ...base, user: { role: "teacher", teacherRole: "owner", onboardingCompleted: false } })
    ).toBe(false);
    expect(
      isExamFocusPromptDue({ ...base, user: { role: "teacher", teacherRole: "manager", onboardingCompleted: true } })
    ).toBe(false);
  });

  it("never asks admins", () => {
    expect(isExamFocusPromptDue({ ...base, user: { role: "admin", onboardingCompleted: true } })).toBe(false);
  });
});