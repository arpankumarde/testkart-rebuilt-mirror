import React from "react";
import { Helmet } from "react-helmet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/Tabs";
import { StudentWalletOverview } from "../components/StudentWalletOverview";
import { StudentBankDetailsForm } from "../components/StudentBankDetailsForm";
import { StudentWithdrawalSection } from "../components/StudentWithdrawalSection";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import styles from "./student.wallet.module.css";

const StudentWalletPage: React.FC = () => {
  return (
    <div className={styles.page}>
      <Helmet>
        <title>Wallet | Testkart</title>
        <meta
          name="description"
          content="Manage your earnings, bank details, and withdrawals on Testkart."
        />
      </Helmet>

      <ConsolePageHeader title="Wallet" />

      <Tabs defaultValue="overview" className={styles.tabsContainer}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="bank-details">Bank details</TabsTrigger>
          <TabsTrigger value="withdrawals">Withdrawals</TabsTrigger>
        </TabsList>

        <div className={styles.tabContent}>
          <TabsContent value="overview">
            <StudentWalletOverview />
          </TabsContent>
          <TabsContent value="bank-details">
            <StudentBankDetailsForm />
          </TabsContent>
          <TabsContent value="withdrawals">
            <StudentWithdrawalSection />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};

export default StudentWalletPage;
