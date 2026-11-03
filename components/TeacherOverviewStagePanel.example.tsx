import React from "react";
import { teacherConsoleClass } from "./TeacherConsoleTheme";
import { TeacherOverviewStagePanel } from "./TeacherOverviewStagePanel";
import { TeacherOverviewShelf } from "./TeacherOverviewShelf";
import { TeacherOverviewProfileChecklist } from "./TeacherOverviewProfileChecklist";
import { TeacherOverviewHelpStrip } from "./TeacherOverviewHelpStrip";

const totals: any = {
  publishedTests: 0,
  draftTests: 0,
  publishedCourses: 0,
  draftCourses: 0,
  publishedProducts: 0,
  draftProducts: 0,
  publishedBundles: 0,
  draftBundles: 0,
  activeLiveTests: 0,
  students: 0,
  followers: 0,
  lifetimeEarnings: 0,
  availableBalance: 0,
};

const base: any = { totals, attention: {}, lastDraft: null, inReview: [], rejected: [], firstContentType: "mock_test" };

const user: any = { teacherRole: "owner", avatarUrl: null, tagline: "", bio: "", expertiseAreas: ["CTET"], languages: [], socialLinks: {} };

export default function TeacherOverviewStagePanelExample() {
  return (
    <div className={teacherConsoleClass} style={{ padding: 24, background: "var(--tc-bg)", minHeight: "100vh" }}>
      <div style={{ container: "overview-main / inline-size", display: "flex", flexDirection: "column", gap: 20, maxWidth: 1088, margin: "0 auto" } as React.CSSProperties}>
        <TeacherOverviewStagePanel stage="start" data={base} profileSlug="demo" />
        <TeacherOverviewProfileChecklist user={user} />
        <TeacherOverviewHelpStrip />
        <TeacherOverviewStagePanel
          stage="review"
          data={{
            ...base,
            rejected: [{ kind: "course", id: 2, title: "NEET Biology Crash Course", at: new Date(), note: "Add a preview lesson and a clearer thumbnail." }],
          }}
          profileSlug="demo"
        />
        <TeacherOverviewShelf totals={{ ...totals, publishedTests: 4, draftTests: 1, draftCourses: 2 }} />
      </div>
    </div>
  );
}
