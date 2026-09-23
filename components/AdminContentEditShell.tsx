import React, { useEffect } from "react";
import { Helmet } from "react-helmet";
import { Link, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, ScanEye } from "lucide-react";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";
import { ConsolePageHeader } from "./ConsolePageHeader";
import { ConsoleListEmpty } from "./ConsoleListEmpty";
import { ADMIN_EDIT_LABELS, AdminEditType } from "../helpers/adminContentEdit";
import { AdminContentEditContext } from "../helpers/useAdminContentEdit";
import { useAdminContentEditSession } from "../helpers/useAdminContentEditSession";
import { adminPreviewPath, dropAdminCatalogueCaches } from "../helpers/useAdminContentPreview";
import { parseErrorMessage } from "../helpers/parseErrorMessage";
import styles from "./AdminContentEditShell.module.css";

interface AdminContentEditShellProps {
  type: AdminEditType;
  id: number | null;
  /** The admin list this kind of item belongs to. */
  listHref: string;
  listLabel: string;
  /** Caps the editor at the teacher console's form width, for single-column forms. */
  narrow?: boolean;
  children: React.ReactNode;
}

/* Admin page frame around a teacher editor: opens the editing session and says whose item it is. */
export const AdminContentEditShell = ({ type, id, listHref, listLabel, narrow, children }: AdminContentEditShellProps) => {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const session = useAdminContentEditSession(type, id);
  const label = ADMIN_EDIT_LABELS[type];
  const exit =
    searchParams.get("from") === "preview" && id !== null
      ? { href: adminPreviewPath(type, id), label: "preview" }
      : { href: listHref, label: listLabel };

  useEffect(() => () => dropAdminCatalogueCaches(queryClient), [queryClient]);

  const helmet = (
    <Helmet>
      <title>{session.data ? `Edit: ${session.data.title}` : `Edit ${label}`} - Testkart Admin</title>
      <meta name="robots" content="noindex,nofollow" />
    </Helmet>
  );

  const backLink = (
    <Link to={exit.href} className={styles.backLink}>
      <ArrowLeft size={16} aria-hidden="true" />
      Back to {exit.label}
    </Link>
  );

  if (id === null) {
    return (
      <div className={styles.page}>
        {helmet}
        {backLink}
        <ConsoleListEmpty
          tone="error"
          icon={<AlertCircle size={24} />}
          title="This edit link is not valid"
          description={`Open the ${label} again from ${listLabel}.`}
        />
      </div>
    );
  }

  if (session.error) {
    return (
      <div className={styles.page}>
        {helmet}
        {backLink}
        <ConsoleListEmpty
          tone="error"
          icon={<AlertCircle size={24} />}
          title={`Could not open this ${label} for editing`}
          description={parseErrorMessage(session.error)}
        >
          <Button variant="outline" onClick={() => session.retry()} disabled={session.isRetrying}>
            Try again
          </Button>
        </ConsoleListEmpty>
      </div>
    );
  }

  if (!session.ready || !session.data) {
    return (
      <div className={styles.page}>
        {helmet}
        {backLink}
        <Skeleton style={{ height: "2.25rem", width: "50%" }} />
        <Skeleton style={{ height: "3.5rem", width: "100%" }} />
        <Skeleton style={{ height: "24rem", width: "100%" }} />
      </div>
    );
  }

  const teacherName = session.data.teacher.name;

  return (
    <div className={styles.page}>
      {helmet}
      {backLink}
      <ConsolePageHeader title={`Edit ${label}`}>
        <Button variant="outline" asChild>
          <Link to={adminPreviewPath(type, id)}>
            <ScanEye size={16} />
            Preview
          </Link>
        </Button>
      </ConsolePageHeader>
      <p className={styles.notice}>
        <strong>You are editing {teacherName}&apos;s {label}.</strong> Saved changes apply straight away and its
        status stays as it is. Publishing, deleting and AI tools stay with the teacher.
      </p>
      <AdminContentEditContext.Provider value={{ type, id, teacherName, exitTo: exit.href }}>
        <div className={`${styles.editor} ${narrow ? styles.narrow : ""}`}>{children}</div>
      </AdminContentEditContext.Provider>
    </div>
  );
};