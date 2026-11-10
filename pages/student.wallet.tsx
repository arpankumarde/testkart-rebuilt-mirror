import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { useSearchParams } from "react-router-dom";
import { AlertCircle, Banknote, CheckCircle, Clock, Landmark, type LucideIcon } from "lucide-react";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { ConsoleListToolbar, type ConsoleListTab } from "../components/ConsoleListToolbar";
import { StudentWithdrawalSection } from "../components/StudentWithdrawalSection";
import { StudentWalletTransactions } from "../components/StudentWalletTransactions";
import { StudentTcoinsSummary, StudentTcoinsHistory } from "../components/StudentTcoinsCard";
import { StudentWithdrawDialog, STUDENT_MIN_WITHDRAWAL } from "../components/StudentWithdrawDialog";
import { StudentBankDetailsDialog } from "../components/StudentBankDetailsDialog";
import { useStudentWalletBalance } from "../helpers/useStudentWallet";
import { useStudentWithdrawalsList } from "../helpers/useStudentWithdrawals";
import { useStudentBankDetailsQuery } from "../helpers/useStudentBankDetails";
import { useStudentTcoins } from "../helpers/useTcoins";
import { useWithdrawalDailyLock } from "../helpers/useWithdrawalDailyLock";
import { formatIstDateTime, WITHDRAWAL_DAILY_LIMIT_MESSAGE } from "../helpers/withdrawalDailyLimit";
import styles from "./student.wallet.module.css";

const rupees = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

type OpenDialog = "withdraw" | "bank" | null;

const LedgerRow = ({ label, value, isLoading }: { label: string; value: string; isLoading: boolean }) => (
  <div className={styles.ledgerRow}>
    <dt>{label}</dt>
    <dd>{isLoading ? <Skeleton style={{ height: "1.25rem", width: "96px" }} /> : value}</dd>
  </div>
);

const StudentWalletPage: React.FC = () => {
  const { data: balanceData, isFetching: isFetchingBalance, refetch: refetchBalance } = useStudentWalletBalance();
  const { data: withdrawalData, isFetching: isFetchingWithdrawals, refetch: refetchWithdrawals } = useStudentWithdrawalsList();
  const { data: bankDetails, isFetching: isFetchingBank } = useStudentBankDetailsQuery();
  const { data: tcoins } = useStudentTcoins();
  const [openDialog, setOpenDialog] = useState<OpenDialog>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  // One list at a time. ?tab= picks it, so the dashboard's Tcoins tile can land on its history.
  const tcoinsOn = !!tcoins?.enabled;
  const tabs: ConsoleListTab[] = [
    { value: "transactions", label: "Transactions" },
    { value: "withdrawals", label: "Withdrawals" },
    ...(tcoinsOn ? [{ value: "tcoins", label: "Tcoins" }] : []),
  ];
  const requestedTab = searchParams.get("tab");
  const tab = tabs.some((t) => t.value === requestedTab) ? requestedTab : "transactions";

  // The app never refetches a cached query on mount, so pull fresh figures on arrival.
  useEffect(() => {
    refetchBalance();
    refetchWithdrawals();
  }, [refetchBalance, refetchWithdrawals]);

  const isBalanceLoading = isFetchingBalance && !balanceData;
  const isWithdrawalsLoading = isFetchingWithdrawals && !withdrawalData;
  const isStatusLoading = isBalanceLoading || isWithdrawalsLoading || (isFetchingBank && bankDetails === undefined);

  const availableBalance = balanceData?.availableBalance ?? 0;
  const withdrawals = withdrawalData?.withdrawals ?? [];
  const pendingWithdrawal = withdrawals.find((w) => w.status === "pending");
  const hasMinimum = availableBalance >= STUDENT_MIN_WITHDRAWAL;
  const bankStatusName = bankDetails?.verificationStatus ?? "none";
  const dailyLock = useWithdrawalDailyLock(withdrawalData?.dailyLimit);
  const canWithdraw =
    !isStatusLoading && hasMinimum && bankStatusName === "verified" && !pendingWithdrawal && !dailyLock.isLocked;

  const status: { Icon: LucideIcon; text: string; detail?: string } = dailyLock.isLocked
    ? {
        Icon: Clock,
        text: WITHDRAWAL_DAILY_LIMIT_MESSAGE,
        detail: dailyLock.lastRequestedAt ? `Last request: ${formatIstDateTime(dailyLock.lastRequestedAt)}` : undefined,
      }
    : pendingWithdrawal
    ? { Icon: Clock, text: `Your withdrawal of ${rupees.format(pendingWithdrawal.amount)} is being processed. You can request another once it is paid.` }
    : bankStatusName === "verified"
      ? { Icon: CheckCircle, text: hasMinimum ? "Bank details verified. Ready to withdraw." : "Bank details verified. Withdrawals open at ₹50." }
      : bankStatusName === "pending"
        ? { Icon: Clock, text: "Your bank details are being checked. Withdrawals open once they are verified." }
        : bankStatusName === "rejected"
          ? { Icon: AlertCircle, text: "Your bank details were rejected. Open Bank details to see why and fix them." }
          : hasMinimum
            ? { Icon: AlertCircle, text: "Add your bank details to withdraw this balance." }
            : { Icon: AlertCircle, text: "Withdrawals open at ₹50 and need verified bank details." };

  const closeDialog = (open: boolean) => {
    if (!open) setOpenDialog(null);
  };

  // A request made from another tab or the app locks the form here too.
  useEffect(() => {
    if (dailyLock.isLocked) setOpenDialog((current) => (current === "withdraw" ? null : current));
  }, [dailyLock.isLocked]);

  return (
    <div className={styles.page}>
      <Helmet>
        <title>Wallet | Testkart</title>
        <meta name="description" content="Your prize money, withdrawals and bank details on Testkart." />
      </Helmet>

      <ConsolePageHeader title="Wallet" />

      <div className={styles.summary} data-single={tcoinsOn ? undefined : "true"}>
        <section className={styles.balance} aria-labelledby="wallet-balance-label">
          <div className={styles.balanceHead}>
            <h2 id="wallet-balance-label" className={styles.balanceLabel}>Available balance</h2>
            {isBalanceLoading ? (
              <Skeleton className={styles.balanceSkeleton} />
            ) : (
              <p className={styles.balanceValue}>{rupees.format(availableBalance)}</p>
            )}
            <p className={styles.balanceNote}>
              From live test prizes. Withdraw it or use it to buy on Testkart.
            </p>
          </div>

          <div className={styles.balanceFoot}>
            {isStatusLoading ? (
              <Skeleton className={styles.statusSkeleton} />
            ) : (
              <p className={styles.bankStatus} role="status">
                <status.Icon size={16} aria-hidden="true" />
                <span>
                  {status.text}
                  {status.detail && <span className={styles.statusDetail}>{status.detail}</span>}
                </span>
              </p>
            )}
            <div className={styles.balanceActions}>
              <Button
                size="lg"
                className={styles.withdrawButton}
                onClick={() => setOpenDialog("withdraw")}
                disabled={!canWithdraw}
              >
                <Banknote aria-hidden="true" />
                Withdraw
              </Button>
              <Button
                size="lg"
                variant="outline"
                className={styles.bankButton}
                onClick={() => setOpenDialog("bank")}
              >
                <Landmark aria-hidden="true" />
                Bank details
              </Button>
            </div>
          </div>
        </section>

        <StudentTcoinsSummary />
      </div>

      <ConsoleListToolbar
        tabs={tabs}
        value={tab ?? "transactions"}
        onValueChange={(value) => setSearchParams(value === "transactions" ? {} : { tab: value }, { replace: true })}
        tabsLabel="Wallet history"
      />

      {tab === "transactions" && (
        <>
          <section className={styles.totals} aria-label="Wallet totals">
            <dl className={styles.ledger}>
              <LedgerRow label="Prize money won" value={rupees.format(balanceData?.totalCredits ?? 0)} isLoading={isBalanceLoading} />
              <LedgerRow label="Withdrawn" value={rupees.format(balanceData?.totalWithdrawn ?? 0)} isLoading={isBalanceLoading} />
              <LedgerRow label="Spent on purchases" value={rupees.format(balanceData?.totalPurchased ?? 0)} isLoading={isBalanceLoading} />
            </dl>
          </section>
          <StudentWalletTransactions />
        </>
      )}

      {tab === "withdrawals" && (
        <StudentWithdrawalSection withdrawals={withdrawals} isLoading={isWithdrawalsLoading} />
      )}

      {tab === "tcoins" && <StudentTcoinsHistory />}

      <StudentWithdrawDialog
        open={openDialog === "withdraw"}
        onOpenChange={closeDialog}
        availableBalance={availableBalance}
      />
      <StudentBankDetailsDialog open={openDialog === "bank"} onOpenChange={closeDialog} />
    </div>
  );
};

export default StudentWalletPage;