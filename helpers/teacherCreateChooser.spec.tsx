import React from "react";
import superjson from "superjson";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TeacherCreateChooserProvider, useTeacherCreateChooser } from "../components/TeacherCreateChooser";
import { schema as onboardingSchema } from "../endpoints/teacher/onboarding/complete_POST.schema";

const totals = (published: number) => ({
  students: 0,
  followers: 0,
  publishedTests: published,
  draftTests: 0,
  publishedCourses: 0,
  draftCourses: 0,
  publishedProducts: 0,
  draftProducts: 0,
  publishedBundles: 0,
  draftBundles: 0,
  activeLiveTests: 0,
  lifetimeEarnings: 0,
  availableBalance: 0,
});

const mockOverview = (published: number) =>
  spyOn(globalThis, "fetch").and.callFake(async () =>
    new Response(superjson.stringify({ totals: totals(published) }), { status: 200 })
  );

const Opener = () => {
  const { openChooser } = useTeacherCreateChooser();
  return (
    <button type="button" onClick={openChooser}>
      open chooser
    </button>
  );
};

const renderChooser = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <TeacherCreateChooserProvider>
          <Opener />
        </TeacherCreateChooserProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );

describe("TeacherCreateChooser", () => {
  beforeAll(() => {
    const g = globalThis as Record<string, unknown>;
    for (const name of ["Event", "CustomEvent", "KeyboardEvent", "MouseEvent", "FocusEvent", "PointerEvent"]) {
      const ctor = (window as unknown as Record<string, unknown>)[name];
      if (ctor) g[name] = ctor;
    }
    if (!window.matchMedia) {
      (window as unknown as { matchMedia: unknown }).matchMedia = () => ({
        matches: false,
        media: "",
        addEventListener() {},
        removeEventListener() {},
        addListener() {},
        removeListener() {},
        onchange: null,
        dispatchEvent: () => false,
      });
    }
  });

  it("lists the five kinds with their create routes in order", async () => {
    mockOverview(5);
    renderChooser();
    fireEvent.click(screen.getByText("open chooser"));
    await waitFor(() => {
      if (!screen.queryByText("What do you want to create?")) throw new Error("chooser not open");
    });
    const hrefs = Array.from(document.querySelectorAll('[role="dialog"] a')).map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual([
      "/teacher/create-test",
      "/teacher/courses/create",
      "/teacher/products/create",
      "/teacher/create-live-test",
      "/teacher/bundles/create",
    ]);
  });

  it("explains the bundle rule only when fewer than 2 items are published", async () => {
    mockOverview(1);
    renderChooser();
    fireEvent.click(screen.getByText("open chooser"));
    await waitFor(() => {
      if (!screen.queryByText(/You have 1\./)) throw new Error("bundle note missing");
    });
    expect(screen.getByText(/Goes live once it holds 2 published items/)).toBeTruthy();
  });

  it("closes when a kind is picked", async () => {
    mockOverview(5);
    renderChooser();
    fireEvent.click(screen.getByText("open chooser"));
    await waitFor(() => {
      if (!screen.queryByText("Course")) throw new Error("chooser not open");
    });
    expect(screen.queryByText(/Goes live once/)).toBeNull();
    fireEvent.click(screen.getByText("Course"));
    await waitFor(() => {
      if (screen.queryByText("What do you want to create?")) throw new Error("still open");
    });
  });
});

describe("onboarding/complete schema", () => {
  it("accepts the 4-step quiz payload without the dropped questions", () => {
    const parsed = onboardingSchema.safeParse({
      teachingCategories: ["Government Exams"],
      subjects: ["Reasoning"],
      examIds: [12],
      contentTypes: ["Study Notes"],
      languages: ["Hindi"],
    });
    expect(parsed.success).toBe(true);
  });

  it("still accepts the old full payload", () => {
    const parsed = onboardingSchema.safeParse({
      teachingCategories: ["School"],
      subjects: ["Physics"],
      examIds: [3],
      teachingExperienceLevel: "1-3 years",
      currentOccupation: "Coaching Teacher",
      contentTypes: ["Mock Tests"],
      languages: ["English"],
      goals: "Earn extra income",
      discoverySource: "YouTube",
    });
    expect(parsed.success).toBe(true);
  });
});
