import React from "react";
import { Helmet } from "react-helmet";
import { AdminTransactionsTable } from "../components/AdminTransactionsTable";
import { AdminSubscriptionTransactionsTable } from "../components/AdminSubscriptionTransactionsTable";
import { AdminPromoAnalytics } from "../components/AdminPromoAnalytics";
import { AdminTransactionsBreakdown } from "../components/AdminTransactionsBreakdown";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/Tabs";
import { useListUrlParams } from "../helpers/useListUrlParams";
import styles from "./admin.transactions.module.css";

const VIEWS = ["student", "subscription", "promo"] as const;
type View = (typeof VIEWS)[number];

/*
 * The open tab is ?view= (absent means Student payments), so dashboard links
 * that only carry student filters always land on the student list, and the
 * student filters stay in the URL while another tab is open. The Breakdown
 * popup follows the open ledger and its filters; Promo codes has its own.
 */
const AdminTransactionsPage: React.FC = () => {
  const { read, write } = useListUrlParams();
  const view = read<View>("view", VIEWS, "student");

  const handleTabChange = (next: string) => write({ view: next === "student" ? null : next });

  const viewPromoOrders = (code: string) => write({ view: null, promo: code, page: null });

  return (
    <>
      <Helmet>
        <title>Transactions - Testkart Admin</title>
        <meta name="description" content="Student and subscription payments across the platform." />
      </Helmet>
      <div className={styles.page}>
        <ConsolePageHeader title="Transactions">
          {view !== "promo" && <AdminTransactionsBreakdown key={view} scope={view} />}
        </ConsolePageHeader>

        <Tabs value={view} onValueChange={handleTabChange} className={styles.tabs}>
          <TabsList className={styles.tabsList}>
            <TabsTrigger value="student">Student payments</TabsTrigger>
            <TabsTrigger value="subscription">Subscription payments</TabsTrigger>
            <TabsTrigger value="promo">Promo codes</TabsTrigger>
          </TabsList>
          <TabsContent value="student">
            <AdminTransactionsTable />
          </TabsContent>
          <TabsContent value="subscription">
            <AdminSubscriptionTransactionsTable />
          </TabsContent>
          <TabsContent value="promo">
            <AdminPromoAnalytics onViewOrders={viewPromoOrders} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};

export default AdminTransactionsPage;