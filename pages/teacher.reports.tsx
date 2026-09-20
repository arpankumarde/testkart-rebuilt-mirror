import React, { useState, useMemo, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  Banknote,
  Calendar as CalendarIcon,
  CheckCircle,
  Clock,
  Download,
  Landmark,
  type LucideIcon,
} from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { addDays, format } from 'date-fns';
import Papa from 'papaparse';
import { useTeacherEarningsQuery } from '../helpers/useTeacherEarningsQuery';
import { useTeacherBankDetailsQuery } from '../helpers/useTeacherBankDetails';
import { useEarningsBalance } from '../helpers/useTeacherSponsoredEnrollments';
import { Button } from '../components/Button';
import { Skeleton } from '../components/Skeleton';
import { BankDetailsDialog } from '../components/BankDetailsDialog';
import { TeacherBankAccountDialog } from '../components/TeacherBankAccountDialog';
import { TeacherWithdrawalSection } from '../components/TeacherWithdrawalSection';
import { WithdrawalRequestDialog } from '../components/WithdrawalRequestDialog';
import { TeacherPageHeader } from '../components/TeacherPageHeader';
import { Popover, PopoverTrigger, PopoverContent } from '../components/Popover';
import { Calendar } from '../components/Calendar';
import styles from './teacher.reports.module.css';

const MIN_WITHDRAWAL = 100;

const rupees = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

type OpenDialog = 'account' | 'editBank' | 'withdraw' | null;

const LedgerRow = ({ label, value, isLoading }: { label: string; value: string; isLoading: boolean }) => (
  <div className={styles.ledgerRow}>
    <dt>{label}</dt>
    <dd>{isLoading ? <Skeleton style={{ height: '1.25rem', width: '96px' }} /> : value}</dd>
  </div>
);

const TeacherReportsPage: React.FC = () => {
  const { data: transactions, isFetching, error } = useTeacherEarningsQuery();
  const { data: bankDetails, isFetching: isFetchingBankDetails } = useTeacherBankDetailsQuery();
  const { data: balanceData, isFetching: isFetchingBalance, refetch: refetchBalance } = useEarningsBalance();

  const [openDialog, setOpenDialog] = useState<OpenDialog>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: addDays(new Date(), -30),
    to: new Date(),
  });

  // The app never refetches a cached query on mount, so pull a fresh balance on arrival.
  useEffect(() => {
    refetchBalance();
  }, [refetchBalance]);

  const filteredTransactions = useMemo(() => {
    if (!transactions) return [];
    if (!dateRange?.from) return transactions;
    return transactions.filter(t => {
      if (!t.transactionDate) return false;
      const txDate = new Date(t.transactionDate);
      const from = dateRange.from!;
      const to = dateRange.to ?? from;
      return txDate >= from && txDate <= addDays(to, 1); // include the 'to' day
    });
  }, [transactions, dateRange]);

  // Balance and totals are lifetime figures, so the date range only narrows the table.
  const summary = useMemo(() => {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const thisMonthEarnings = (transactions ?? [])
      .filter(t => t.transactionType === 'sale' && t.transactionDate && new Date(t.transactionDate) >= firstDayOfMonth && !(t.isLiveTest && !t.liveTestEnded))
      .reduce((acc, t) => acc + t.amountEarned, 0);

    return {
      availableBalance: balanceData?.availableBalance ?? 0,
      totalEarnings: balanceData?.totalEarned ?? 0,
      totalWithdrawn: balanceData?.totalWithdrawn ?? 0,
      totalSales: balanceData?.breakdown.sales.count ?? 0,
      sponsoredCount: balanceData?.breakdown.sponsored.count ?? 0,
      thisMonthEarnings,
    };
  }, [transactions, balanceData]);

  const isBalanceLoading = isFetchingBalance && !balanceData;
  const isTransactionsLoading = isFetching && !transactions;
  const isBankLoading = isFetchingBankDetails && bankDetails === undefined;

  const hasMinimum = summary.availableBalance >= MIN_WITHDRAWAL;
  const bankStatusName = bankDetails?.verificationStatus ?? 'none';
  const canWithdraw = hasMinimum && bankStatusName === 'verified' && !isBalanceLoading;

  const bankStatus: { Icon: LucideIcon; text: string } =
    bankStatusName === 'verified'
      ? { Icon: CheckCircle, text: hasMinimum ? 'Bank account verified. Ready to withdraw.' : 'Bank account verified. Withdrawals open at ₹100.' }
      : bankStatusName === 'pending'
        ? { Icon: Clock, text: 'Your bank account is being verified. Withdrawals open once it is.' }
        : bankStatusName === 'rejected'
          ? { Icon: AlertCircle, text: 'Your bank account was rejected. Open Bank account to see why.' }
          : { Icon: AlertCircle, text: hasMinimum ? 'Add a bank account to withdraw this balance.' : 'Withdrawals open at ₹100 and need a verified bank account.' };

  const closeDialog = (open: boolean) => {
    if (!open) setOpenDialog(null);
  };

  const handleExportCSV = () => {
    if (!filteredTransactions || filteredTransactions.length === 0) return;

    const data = filteredTransactions.map((tx) => {
      const type = tx.transactionType as string;

      let itemTitle = tx.testTitle;
      let studentName = tx.studentName;

      if (type === 'sponsored') {
        itemTitle = `Sponsored: ${tx.studentName}`;
        studentName = tx.testTitle;
      } else if (type === 'prize_deduction') {
        studentName = `Winner: ${tx.studentName}`;
      } else if (type === 'subscription') {
        studentName = tx.studentName;
      } else {
        studentName = `by ${tx.studentName}`;
      }

      return {
        Date: tx.transactionDate ? format(new Date(tx.transactionDate), 'yyyy-MM-dd') : 'N/A',
        Type: type === 'sponsored' ? 'Sponsored' : type === 'prize_deduction' ? 'Prize Deduction' : type === 'subscription' ? 'Subscription' : type.charAt(0).toUpperCase() + type.slice(1),
        'Item Title': itemTitle,
        'Student Name': studentName,
        'Gross Amount': tx.grossAmount.toFixed(2),
        'Platform Fee %': type === 'withdrawal' || type === 'prize_deduction' || type === 'subscription' ? '-' : `${tx.platformFeePercentage.toFixed(0)}%`,
        'Net Earnings': tx.amountEarned.toFixed(2),
      };
    });

    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);

    const fromStr = dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : 'all';
    const toStr = dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : 'all';

    link.setAttribute('download', `testkart-earnings-${fromStr}-${toStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <Helmet>
        <title>My Earnings - Testkart</title>
        <meta name="description" content="View your earnings, transactions, and detailed sales data." />
      </Helmet>
      <div className={styles.page}>
        <TeacherPageHeader title="Earnings">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <CalendarIcon size={16} />
                <span>
                  {dateRange?.from ? (
                    dateRange.to ? (
                      `${format(dateRange.from, "LLL dd, y")} - ${format(dateRange.to, "LLL dd, y")}`
                    ) : (
                      format(dateRange.from, "LLL dd, y")
                    )
                  ) : (
                    "Select date range"
                  )}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent removeBackgroundAndPadding align="end">
              <Calendar
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
          <Button
            variant="outline"
            onClick={handleExportCSV}
            disabled={isFetching || filteredTransactions.length === 0}
          >
            <Download size={16} />
            Export CSV
          </Button>
        </TeacherPageHeader>

        <div className={styles.summary}>
          <section className={styles.balance} aria-labelledby="balance-label">
            <div className={styles.balanceHead}>
              <h2 id="balance-label" className={styles.balanceLabel}>Available balance</h2>
              {isBalanceLoading ? (
                <Skeleton className={styles.balanceSkeleton} />
              ) : (
                <p className={styles.balanceValue}>{rupees.format(summary.availableBalance)}</p>
              )}
              <p className={styles.balanceNote}>
                What is left after sales, withdrawals, sponsorships and subscription payments.
              </p>
            </div>

            <div className={styles.balanceFoot}>
              {isBankLoading ? (
                <Skeleton className={styles.statusSkeleton} />
              ) : (
                <p className={styles.bankStatus}>
                  <bankStatus.Icon size={16} aria-hidden="true" />
                  <span>{bankStatus.text}</span>
                </p>
              )}
              <div className={styles.balanceActions}>
                <Button
                  size="lg"
                  className={styles.withdrawButton}
                  onClick={() => setOpenDialog('withdraw')}
                  disabled={!canWithdraw}
                >
                  <Banknote aria-hidden="true" />
                  Withdraw
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className={styles.bankButton}
                  onClick={() => setOpenDialog('account')}
                >
                  <Landmark aria-hidden="true" />
                  Bank account
                </Button>
              </div>
            </div>
          </section>

          <section className={`${styles.panel} ${styles.totals}`} aria-label="Earnings totals">
            <dl className={styles.ledger}>
              <LedgerRow label="Earned this month" value={rupees.format(summary.thisMonthEarnings)} isLoading={isTransactionsLoading} />
              <LedgerRow label="Earned in total" value={rupees.format(summary.totalEarnings)} isLoading={isBalanceLoading} />
              <LedgerRow label="Withdrawn in total" value={rupees.format(summary.totalWithdrawn)} isLoading={isBalanceLoading} />
              <LedgerRow label="Sales" value={summary.totalSales.toLocaleString('en-IN')} isLoading={isBalanceLoading} />
              <LedgerRow label="Sponsored students" value={summary.sponsoredCount.toLocaleString('en-IN')} isLoading={isBalanceLoading} />
            </dl>
          </section>
        </div>

        <TeacherWithdrawalSection isLayoutPending={isBalanceLoading || isTransactionsLoading || isBankLoading} />

        <section className={styles.panel} aria-labelledby="transactions-title">
          <div className={styles.panelHead}>
            <h2 id="transactions-title" className={styles.panelTitle}>Transactions</h2>
            <p className={styles.intro}>
              Every figure is what you keep after the platform fee. Your fee rate depends on your
              plan - <Link to="/teacher/subscription" className={styles.introLink}>see plans</Link> to
              lower it. Sponsorships paid from your balance and subscription payments come out of it;
              sponsorships paid online are listed for reference only.
            </p>
          </div>

          {error && (
            <div className={styles.error} role="alert">
              Could not load transactions: {error instanceof Error ? error.message : 'an unknown error occurred'}.
            </div>
          )}

          <div className={styles.results}>
            <table className={styles.table}>
              <colgroup>
                <col className={styles.colDate} />
                <col className={styles.colType} />
                <col />
                <col className={styles.colMoney} />
                <col className={styles.colFee} />
                <col className={styles.colMoney} />
              </colgroup>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Details</th>
                  <th className={styles.numeric}>Gross</th>
                  <th className={styles.numeric}>Fee</th>
                  <th className={styles.numeric}>You keep</th>
                </tr>
              </thead>
              <tbody>
                {isTransactionsLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td><Skeleton style={{ height: '1.25rem', width: '88px' }} /></td>
                      <td><Skeleton style={{ height: '1.25rem', width: '72px' }} /></td>
                      <td><Skeleton style={{ height: '1.25rem', width: '200px', maxWidth: '100%' }} /></td>
                      <td className={styles.numeric}><Skeleton style={{ height: '1.25rem', width: '72px', marginLeft: 'auto' }} /></td>
                      <td className={styles.numeric}><Skeleton style={{ height: '1.25rem', width: '40px', marginLeft: 'auto' }} /></td>
                      <td className={styles.numeric}><Skeleton style={{ height: '1.25rem', width: '72px', marginLeft: 'auto' }} /></td>
                    </tr>
                  ))
                ) : filteredTransactions.length > 0 ? (
                  filteredTransactions.map((tx, i) => {
                    const txType = tx.transactionType as string; // Cast for potentially new types like 'sponsored'
                    const isPendingLiveTest = !!tx.isLiveTest && !tx.liveTestEnded;
                    const hasNoFee = txType === 'withdrawal' || txType === 'prize_deduction' || txType === 'subscription';
                    const netClass =
                      txType === 'sale' && !isPendingLiveTest ? styles.amountEarned :
                      txType === 'sale' && isPendingLiveTest ? styles.amountPending :
                      hasNoFee ? styles.amountOut :
                      txType === 'sponsored' && tx.amountEarned !== 0 ? styles.amountOut :
                      styles.amountNeutral;

                    return (
                      <tr key={i}>
                        <td className={styles.date}>{tx.transactionDate ? format(new Date(tx.transactionDate), 'MMM dd, yyyy') : 'N/A'}</td>
                        <td>
                          <span className={`${styles.typeBadge} ${styles[txType]}`}>
                            {txType === 'sponsored' ? 'Sponsored' : txType === 'prize_deduction' ? 'Prize deduction' : txType === 'subscription' ? 'Subscription' : txType}
                          </span>
                        </td>
                        <td>
                          <div className={styles.detailsCell}>
                            {txType === 'sponsored' ? (
                              <>
                                <span className={styles.itemTitle}>Sponsored: {tx.studentName}</span>
                                <span className={styles.counterparty}>{tx.testTitle}</span>
                              </>
                            ) : txType === 'prize_deduction' ? (
                              <>
                                <span className={styles.itemTitle}>{tx.testTitle}</span>
                                <span className={styles.counterparty}>Winner: {tx.studentName}</span>
                              </>
                            ) : txType === 'subscription' ? (
                              <>
                                <span className={styles.itemTitle}>{tx.testTitle}</span>
                                <span className={styles.counterparty}>{tx.studentName}</span>
                              </>
                            ) : (
                              <>
                                <span className={styles.itemTitle}>{tx.testTitle}</span>
                                <span className={styles.counterparty}>by {tx.studentName}</span>
                              </>
                            )}
                            {isPendingLiveTest && (
                              <span className={styles.pendingNote}>
                                <Clock size={12} aria-hidden="true" />
                                Credited after the live test ends and prizes are paid
                              </span>
                            )}
                          </div>
                        </td>
                        <td className={styles.numeric} data-label="Gross">
                          {rupees.format(tx.grossAmount)}
                          {txType === 'sponsored' && <span className={styles.cellNote}>commission</span>}
                        </td>
                        <td className={styles.numeric} data-label="Fee">
                          {hasNoFee ? '-' : `${tx.platformFeePercentage.toFixed(0)}%`}
                        </td>
                        <td className={`${styles.numeric} ${netClass}`} data-label="You keep">
                          {txType === 'sponsored' && tx.amountEarned === 0 ? '-' : rupees.format(tx.amountEarned)}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr className={styles.emptyRow}>
                    <td colSpan={6}>Nothing in this date range. Widen the range to see more.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <TeacherBankAccountDialog
          open={openDialog === 'account'}
          onOpenChange={closeDialog}
          bankDetails={bankDetails ?? null}
          canManage={hasMinimum}
          onEdit={() => setOpenDialog('editBank')}
        />
        <BankDetailsDialog
          open={openDialog === 'editBank'}
          onOpenChange={closeDialog}
          existingDetails={bankDetails ?? null}
        />
        <WithdrawalRequestDialog
          open={openDialog === 'withdraw'}
          onOpenChange={closeDialog}
          availableBalance={summary.availableBalance}
        />
      </div>
    </>
  );
};

export default TeacherReportsPage;