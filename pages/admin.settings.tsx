import React from "react";
import { Helmet } from "react-helmet";
import { useAdminAuth } from "../helpers/useAdminAuth";
import { Navigate } from "react-router-dom";
import { Skeleton } from "../components/Skeleton";
import { ScriptsManager } from "../components/ScriptsManager";
import { AIProviderManager } from "../components/AIProviderManager";
import { AdminUploadLimitsManager } from "../components/AdminUploadLimitsManager";
import { AdminManagementSection } from "../components/AdminManagementSection";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/Tabs";
import { hasAdminModule } from "../helpers/adminPermissions";
import styles from "./admin.settings.module.css";

const AdminSettingsPage: React.FC = () => {
  const { authState } = useAdminAuth();

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

  if (authState.type === "unauthenticated" || (!canManageAdmins && !canEditSettings)) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return (
    <>
      <Helmet>
        <title>Settings - Testkart Admin</title>
        <meta name="description" content="Platform-wide settings for Testkart." />
      </Helmet>
      <div className={styles.page}>
        <ConsolePageHeader title="Settings" />

        <Tabs defaultValue={canManageAdmins ? "general" : "scripts"} className={styles.tabs}>
          <TabsList className={styles.tabsList}>
            {canManageAdmins && <TabsTrigger value="general">Admins and access</TabsTrigger>}
            {canEditSettings && (
              <>
                <TabsTrigger value="scripts">Scripts</TabsTrigger>
                <TabsTrigger value="ai">AI provider</TabsTrigger>
                <TabsTrigger value="limits">Upload limits</TabsTrigger>
              </>
            )}
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
        </Tabs>
      </div>
    </>
  );
};

export default AdminSettingsPage;
