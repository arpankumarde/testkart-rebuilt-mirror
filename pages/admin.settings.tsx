import React from "react";
import { Helmet } from "react-helmet";
import { useAdminAuth } from "../helpers/useAdminAuth";
import { Navigate, useLocation } from "react-router-dom";
import { Skeleton } from "../components/Skeleton";
import { ScriptsManager } from "../components/ScriptsManager";
import { AIProviderManager } from "../components/AIProviderManager";
import { AdminUploadLimitsManager } from "../components/AdminUploadLimitsManager";
import { AdminManagementSection } from "../components/AdminManagementSection";
import { ConnectedAppsSection } from "../components/TeacherAccountAccess";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/Tabs";
import { hasAdminModule } from "../helpers/adminPermissions";
import { adminNavigation } from "../helpers/adminNavigation";
import styles from "./admin.settings.module.css";

/** Also the #hash the connector card's disconnect hint links to. */
const AI_APPS_TAB = "ai-apps";

const AdminSettingsPage: React.FC = () => {
  const { authState } = useAdminAuth();
  const location = useLocation();

  if (authState.type === "loading") {
    return (
      <div className={styles.page} aria-busy="true">
        <Skeleton style={{ height: "2rem", width: "10rem" }} />
        <Skeleton style={{ height: "2.5rem", width: "100%" }} />
        <Skeleton style={{ height: "24rem", width: "100%", borderRadius: "var(--radius-md)" }} />
      </div>
    );
  }

  const permissions = authState.type === "authenticated" ? authState.admin.permissions ?? [] : [];
  const canManageAdmins = hasAdminModule(permissions, ["admins"]);
  const canEditSettings = hasAdminModule(permissions, ["settings"]);

  if (authState.type === "unauthenticated") {
    return <Navigate to="/admin/dashboard" replace />;
  }

  const defaultTab =
    location.hash === `#${AI_APPS_TAB}`
      ? AI_APPS_TAB
      : canManageAdmins
        ? "general"
        : canEditSettings
          ? "scripts"
          : AI_APPS_TAB;
  const connectHref = adminNavigation.canOpen("/admin/dashboard", permissions) ? "/admin/dashboard" : null;

  return (
    <>
      <Helmet>
        <title>Settings - Testkart Admin</title>
        <meta name="description" content="Your connected AI apps and platform-wide settings for Testkart." />
      </Helmet>
      <div className={styles.page}>
        <ConsolePageHeader title="Settings" />

        <Tabs defaultValue={defaultTab} className={styles.tabs}>
          <TabsList className={styles.tabsList}>
            {canManageAdmins && <TabsTrigger value="general">Admins and access</TabsTrigger>}
            {canEditSettings && (
              <>
                <TabsTrigger value="scripts">Scripts</TabsTrigger>
                <TabsTrigger value="ai">AI provider</TabsTrigger>
                <TabsTrigger value="limits">Upload limits</TabsTrigger>
              </>
            )}
            <TabsTrigger value={AI_APPS_TAB}>Connected AI apps</TabsTrigger>
          </TabsList>

          {canManageAdmins && (
            <TabsContent value="general">
              <AdminManagementSection />
            </TabsContent>
          )}

          {canEditSettings && (
            <>
              <TabsContent value="scripts">
                <ScriptsManager />
              </TabsContent>

              <TabsContent value="ai">
                <AIProviderManager />
              </TabsContent>

              <TabsContent value="limits">
                <AdminUploadLimitsManager />
              </TabsContent>
            </>
          )}

          <TabsContent value={AI_APPS_TAB}>
            <ConnectedAppsSection id={AI_APPS_TAB} audience="admin" connectHref={connectHref} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};

export default AdminSettingsPage;
