import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { AlertCircle, Banknote, CheckCircle, Clock, Landmark, type LucideIcon } from "lucide-react";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { StudentWithdrawalSection } from "../components/StudentWithdrawalSection";
import { StudentWalletTransactions } from "../components/StudentWalletTransactions";
import { StudentWithdrawDialog, STUDENT_MIN_WITHDRAWAL } from "../components/StudentWithdrawDialog";
import { StudentBankDetailsDialog } from "../components/StudentBankDetailsDialog";
import { useStudentWalletBalance } from "../helpers/useStudentWallet";
import { useStudentWithdrawalsList } from "../helpers/useStudentWithdrawals";
import { useStudentBankDetailsQuery } from "../helpers/useStudentBankDetails";
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
  const [openDialog, setOpenDialog] = useState<OpenDialog>(null);

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
  const canWithdraw = !isStatusLoading && hasMinimum && bankStatusName === "verified" && !pendingWithdrawal;

  const status: { Icon: LucideIcon; text: string } = pendingWithdrawal
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

  return (
    <div className={styles.page}>
      <Helmet>
        <title>Wallet | Testkart</title>
        <meta name="description" content="Your prize money, withdrawals and bank details on Testkart." />
      </Helmet>

      <ConsolePageHeader title="Wallet" />

      <div className={styles.summary}>
        <section className={styles.balance} aria-labelledby="wallet-balance-label">
          <div className={styles.balanceHead}>
            <h2 id="wallet-balance-label" className={styles.balanceLabel}>Available balance</h2>
            {isBalanceLoading ? (
              <Skeleton className={styles.balanceSkeleton} />
            ) : (
              <p className={styles.balanceValue}>{rupees.format(availableBalance)}</p>
            )}
            <p className={styles.balanceNote}>
              Prize money from live tests, less what you have withdrawn or spent on the site.
            </p>
          </div>

          <div className={styles.balanceFoot}>
            {isStatusLoading ? (
              <Skeleton className={styles.statusSkeleton} />
            ) : (
              <p className={styles.bankStatus}>
                <status.Icon size={16} aria-hidden="true" />
                <span>{status.text}</span>
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

        <section className={styles.totals} aria-label="Wallet totals">
          <dl className={styles.ledger}>
            <LedgerRow label="Prize money won" value={rupees.format(balanceData?.totalCredits ?? 0)} isLoading={isBalanceLoading} />
            <LedgerRow label="Withdrawn" value={rupees.format(balanceData?.totalWithdrawn ?? 0)} isLoading={isBalanceLoading} />
            <LedgerRow label="Spent on purchases" value={rupees.format(balanceData?.totalPurchased ?? 0)} isLoading={isBalanceLoading} />
          </dl>
        </section>
      </div>

      <StudentWithdrawalSection withdrawals={withdrawals} isLoading={isWithdrawalsLoading} />

      <StudentWalletTransactions />

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