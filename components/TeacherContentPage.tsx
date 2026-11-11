import React, { useId } from "react";
import { TeacherPageHeader } from "./TeacherPageHeader";
import { TeacherCreateButton, type TeacherCreateAction } from "./TeacherCreateButton";
import { TeacherContentToolbar, type TeacherContentToolbarProps } from "./TeacherContentToolbar";
import { hasContent } from "./TeacherStatusTabs";
import type { TeacherContentKind } from "../helpers/teacherContentKinds";
import styles from "./TeacherContentPage.module.css";

type Props<V extends string> = {
  kind: TeacherContentKind;
  title: string;
  description: string;
  create: TeacherCreateAction;
  toolbar: TeacherContentToolbarProps<V>;
  /** Between the toolbar and the list, e.g. a notice for a filter the URL applied. */
  notice?: React.ReactNode;
  /** Under the list, e.g. pagination. */
  footer?: React.ReactNode;
  busy?: boolean;
  children: React.ReactNode;
};

/**
 * The shell of every teacher content list (Test series, Courses, Notes and
 * PDFs, Live tests, Bundles): header with the kind's tile and the create
 * button, the status toolbar, then the page's own cards or table. Pages
 * bring their data, statuses and list; the shell owns layout and states.
 */
export const TeacherContentPage = <V extends string>({
  kind,
  title,
  description,
  create,
  toolbar,
  notice,
  footer,
  busy,
  children,
}: Props<V>) => {
  const panelId = useId();
  const tabsShown = hasContent(toolbar.tabs.total) && toolbar.tabs.tabs.length > 0;
  const activeTab = tabsShown ? toolbar.tabs.value : null;

  return (
    <div className={styles.page}>
      <TeacherPageHeader kind={kind} title={title} description={description}>
        <TeacherCreateButton {...create} className={styles.create} />
      </TeacherPageHeader>

      <TeacherContentToolbar {...toolbar} tabs={{ ...toolbar.tabs, panelId }} />

      {notice}

      {/* A section, not <main>: TeacherDashboardLayout provides the one main landmark. */}
      <section
        id={panelId}
        role={activeTab !== null ? "tabpanel" : undefined}
        aria-labelledby={activeTab !== null ? `${panelId}-tab-${activeTab}` : undefined}
        aria-busy={busy || undefined}
        className={styles.content}
      >
        {children}
      </section>

      {footer}
    </div>
  );
};