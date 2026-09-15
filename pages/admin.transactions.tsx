import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { AdminTransactionsTable } from "../components/AdminTransactionsTable";
import { AdminSubscriptionTransactionsTable } from "../components/AdminSubscriptionTransactionsTable";
import { useTransactionsListParams } from "../components/AdminTransactionsTableFilter";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/Tabs";
import styles from "./admin.transactions.module.css";

const AdminTransactionsPage: React.FC = () => {
  const { status, listFilter, write } = useTransactionsListParams();
  const [tab, setTab] = useState("student");

  /* A link that narrows the student list always opens on Student payments. */
  const narrowedByUrl = status !== "__all" || listFilter !== "";

  useEffect(() => {
    if (narrowedByUrl) setTab("student");
  }, [narrowedByUrl]);

  const handleTabChange = (next: string) => {
    setTab(next);
    if (next !== "student" && narrowedByUrl) write({ status: null, filter: null });
  };

  return (
    <>
      <Helmet>
        <title>Transactions - Testkart Admin</title>
        <meta
          name="description"
          content="Student and subscription payments across the platform."
        />
      </Helmet>
      <div className={styles.page}>
        <ConsolePageHeader title="Transactions" />

        <Tabs value={narrowedByUrl ? "student" : tab} onValueChange={handleTabChange} className={styles.tabs}>
          <TabsList className={styles.tabsList}>
            <TabsTrigger value="student">Student payments</TabsTrigger>
            <TabsTrigger value="subscription">Subscription payments</TabsTrigger>
          </TabsList>
          <TabsContent value="student">
            <AdminTransactionsTable />
          </TabsContent>
          <TabsContent value="subscription">
            <AdminSubscriptionTransactionsTable />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};

export default AdminTransactionsPage;
