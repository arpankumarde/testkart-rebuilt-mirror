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

  if (authState.type === "unauthenticated" || authState.admin.role !== "super_admin") {
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

        <Tabs defaultValue="general" className={styles.tabs}>
          <TabsList className={styles.tabsList}>
            <TabsTrigger value="general">Admins</TabsTrigger>
            <TabsTrigger value="scripts">Scripts</TabsTrigger>
            <TabsTrigger value="ai">AI provider</TabsTrigger>
            <TabsTrigger value="limits">Upload limits</TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <AdminManagementSection />
          </TabsContent>

          <TabsContent value="scripts">
            <ScriptsManager />
          </TabsContent>

          <TabsContent value="ai">
            <AIProviderManager />
          </TabsContent>

          <TabsContent value="limits">
            <AdminUploadLimitsManager />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};

export default AdminSettingsPage;
