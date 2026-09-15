import React, { useState, useMemo, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useTeacherEarningsQuery } from '../helpers/useTeacherEarningsQuery';
import { useTeacherBankDetailsQuery } from '../helpers/useTeacherBankDetails';
import { useEarningsBalance } from '../helpers/useTeacherSponsoredEnrollments';
import { Button } from '../components/Button';
import { Skeleton } from '../components/Skeleton';
import { BankDetailsDialog } from '../components/BankDetailsDialog';
import { TeacherWithdrawalSection } from '../components/TeacherWithdrawalSection';
import { TeacherPageHeader } from '../components/TeacherPageHeader';
import { Calendar as CalendarIcon, Download, AlertCircle, Info, CreditCard, CheckCircle, Clock, XCircle, Edit } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Popover, PopoverTrigger, PopoverContent } from '../components/Popover';
import { Calendar } from '../components/Calendar';
import { DateRange } from 'react-day-picker';
import { addDays, format } from 'date-fns';
import Papa from 'papaparse';
import styles from './teacher.reports.module.css';

const Stat = ({ label, value, isLoading }: { label: string; value: string; isLoading: boolean }) => (
  <div className={styles.stat}>
    <span className={styles.statLabel}>{label}</span>
    {isLoading ? <Skeleton style={{ height: '1.5rem', width: '80px' }} /> : <span className={styles.statValue}>{value}</span>}
  </div>
);

const TeacherReportsPage: React.FC = () => {
  const { data: transactions, isFetching, error } = useTeacherEarningsQuery();
  const { data: bankDetails, isFetching: isFetchingBankDetails } = useTeacherBankDetailsQuery();
  const { data: balanceData, isFetching: isFetchingBalance, refetch: refetchBalance } = useEarningsBalance();

  const [isBankDialogOpen, setIsBankDialogOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: addDays(new Date(), -30),
    to: new Date(),
  });

  // Refetch balance when date range changes
  useEffect(() => {
    refetchBalance();
  }, [dateRange, refetchBalance]);

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

  const summaryStats = useMemo(() => {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const availableBalance = balanceData?.availableBalance ?? 0;
    const totalEarnings = balanceData?.totalEarned ?? 0;
    const totalWithdrawn = balanceData?.totalWithdrawn ?? 0;
    const totalSales = balanceData?.breakdown.sales.count ?? 0;
    const sponsoredCount = balanceData?.breakdown.sponsored.count ?? 0;

    const thisMonthEarnings = filteredTransactions
            .filter(t => t.transactionType === 'sale' && t.transactionDate && new Date(t.transactionDate) >= firstDayOfMonth && !(t.isLiveTest && !t.liveTestEnded))
      .reduce((acc, t) => acc + t.amountEarned, 0);

    return { totalEarnings, totalWithdrawn, availableBalance, thisMonthEarnings, totalSales, sponsoredCount };
  }, [filteredTransactions, balanceData]);

  const isStatsLoading = isFetching || isFetchingBalance;
  const canManageBank = summaryStats.availableBalance >= 100;

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
        'Platform Fee %': type === 'withdrawal' || type === 'prize_deduction' || type === 'subscription' ? '—' : `${tx.platformFeePercentage.toFixed(0)}%`,
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
            variant="secondary"
            onClick={handleExportCSV}
            disabled={isFetching || filteredTransactions.length === 0}
          >
            <Download size={16} />
            Export CSV
          </Button>
        </TeacherPageHeader>

        {/* Balance */}
        <section className={styles.panel}>
          <div className={styles.balanceLabelRow}>
            <span>Available balance</span>
            <span className={styles.infoTooltip} title="After sales, withdrawals, and sponsored enrollments">
              <Info size={14} />
            </span>
          </div>
          {isStatsLoading ? (
            <Skeleton style={{ height: '2.5rem', width: '220px' }} />
          ) : (
            <span className={styles.balanceValue}>₹{summaryStats.availableBalance.toFixed(2)}</span>
          )}

          <div className={styles.stats}>
            <Stat label="Total net earnings" value={`₹${summaryStats.totalEarnings.toFixed(2)}`} isLoading={isStatsLoading} />
            <Stat label="Total withdrawn" value={`₹${summaryStats.totalWithdrawn.toFixed(2)}`} isLoading={isStatsLoading} />
            <Stat label="This month (net)" value={`₹${summaryStats.thisMonthEarnings.toFixed(2)}`} isLoading={isFetching} />
            <Stat label="Total sales" value={summaryStats.totalSales.toString()} isLoading={isStatsLoading} />
            <Stat label="Sponsored students" value={summaryStats.sponsoredCount.toString()} isLoading={isStatsLoading} />
          </div>
        </section>

        {/* Bank details */}
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>Bank details</h2>
          <p className={styles.panelSubtitle}>Where Testkart sends your withdrawals</p>

          {isFetchingBankDetails ? (
            <>
              <Skeleton style={{ height: '1.5rem', width: '200px' }} />
              <Skeleton style={{ height: '1rem', width: '150px' }} />
            </>
          ) : !bankDetails ? (
            <>
              <p className={styles.panelSubtitle}>
                Add your account so withdrawals have somewhere to land.
              </p>
              <div className={styles.actionRow}>
                <Button onClick={() => setIsBankDialogOpen(true)} disabled={!canManageBank}>
                  <CreditCard size={16} />
                  Add bank details
                </Button>
              </div>
              {!canManageBank && (
                <div className={`${styles.note} ${styles.noteInfo}`}>
                  <Info size={16} />
                  <span>You need at least ₹100 in earnings before you can add bank details.</span>
                </div>
              )}
            </>
          ) : (
            <>
              <div className={styles.bankGrid}>
                <div className={styles.bankRow}>
                  <span className={styles.bankLabel}>Account number</span>
                  <span className={styles.bankValue}>
                    ****{bankDetails.bankAccountNumber.slice(-4)}
                  </span>
                </div>
                <div className={styles.bankRow}>
                  <span className={styles.bankLabel}>Bank</span>
                  <span className={styles.bankValue}>{bankDetails.bankName}</span>
                </div>
                <div className={styles.bankRow}>
                  <span className={styles.bankLabel}>IFSC code</span>
                  <span className={styles.bankValue}>{bankDetails.bankIfscCode}</span>
                </div>
                {bankDetails.upiId && (
                  <div className={styles.bankRow}>
                    <span className={styles.bankLabel}>UPI ID</span>
                    <span className={styles.bankValue}>{bankDetails.upiId}</span>
                  </div>
                )}
                <div className={styles.bankRow}>
                  <span className={styles.bankLabel}>PAN number</span>
                  <span className={styles.bankValue}>
                    {bankDetails.panNumber.substring(0, 2)}******{bankDetails.panNumber.slice(-2)}
                  </span>
                </div>
                <div className={styles.bankRow}>
                  <span className={styles.bankLabel}>Status</span>
                  <span>
                    {bankDetails.verificationStatus === 'pending' && (
                      <span className={`${styles.statusBadge} ${styles.statusPending}`}>
                        <Clock size={14} />
                        Pending verification
                      </span>
                    )}
                    {bankDetails.verificationStatus === 'verified' && (
                      <span className={`${styles.statusBadge} ${styles.statusVerified}`}>
                        <CheckCircle size={14} />
                        Verified
                      </span>
                    )}
                    {bankDetails.verificationStatus === 'rejected' && (
                      <span className={`${styles.statusBadge} ${styles.statusRejected}`}>
                        <XCircle size={14} />
                        Rejected
                      </span>
                    )}
                  </span>
                </div>
              </div>

              {bankDetails.verificationStatus === 'pending' && (
                <div className={`${styles.note} ${styles.noteInfo}`}>
                  <Info size={16} />
                  <span>These details are under review. We will let you know once they are verified.</span>
                </div>
              )}

              {bankDetails.verificationStatus === 'rejected' && bankDetails.rejectionReason && (
                <div className={`${styles.note} ${styles.noteError}`}>
                  <AlertCircle size={16} />
                  <div className={styles.noteBody}>
                    <p><strong>Rejected:</strong> {bankDetails.rejectionReason}</p>
                    <p>Correct the details and submit them again.</p>
                  </div>
                </div>
              )}

              <div className={styles.actionRow}>
                <Button
                  variant="outline"
                  onClick={() => setIsBankDialogOpen(true)}
                  disabled={!canManageBank && bankDetails.verificationStatus !== 'verified'}
                >
                  <Edit size={16} />
                  Edit bank details
                </Button>
              </div>
              {!canManageBank && bankDetails.verificationStatus !== 'verified' && (
                <div className={`${styles.note} ${styles.noteInfo}`}>
                  <Info size={16} />
                  <span>You need at least ₹100 in earnings before you can change bank details.</span>
                </div>
              )}
            </>
          )}
        </section>

        <TeacherWithdrawalSection
          availableBalance={summaryStats.availableBalance}
          isBankDetailsVerified={bankDetails?.verificationStatus === 'verified'}
          isLoadingBalance={isFetchingBalance}
          isLayoutPending={isStatsLoading || isFetchingBankDetails}
        />

        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>Transaction history</h2>

          <div className={`${styles.note} ${styles.noteInfo}`}>
            <Info size={18} />
            <div className={styles.noteBody}>
              <p>
                Every figure here is what you keep, after the platform fee. Your fee rate comes from
                your plan - <Link to="/teacher/subscription" className={styles.noteLink}>see plans</Link> to
                lower it.
              </p>
              <p>
                Sponsorships paid from your wallet and subscription payments come out of this balance.
                Sponsorships paid online are listed for reference only.
              </p>
            </div>
          </div>

          {error && (
            <div className={styles.error} role="alert">
              Could not load transactions: {error instanceof Error ? error.message : 'an unknown error occurred'}.
            </div>
          )}

          <div className={styles.tableWrapper}>
            <table className={styles.table}>
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
                {isFetching ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td><Skeleton style={{ height: '1.25rem', width: '100px' }} /></td>
                      <td><Skeleton style={{ height: '1.25rem', width: '80px' }} /></td>
                      <td><Skeleton style={{ height: '1.25rem', width: '220px' }} /></td>
                      <td className={styles.numeric}><Skeleton style={{ height: '1.25rem', width: '80px' }} /></td>
                      <td className={styles.numeric}><Skeleton style={{ height: '1.25rem', width: '50px' }} /></td>
                      <td className={styles.numeric}><Skeleton style={{ height: '1.25rem', width: '80px' }} /></td>
                    </tr>
                  ))
                ) : filteredTransactions.length > 0 ? (
                  filteredTransactions.map((tx, i) => {
                    const txType = tx.transactionType as string; // Cast for potentially new types like 'sponsored'
                    const isPendingLiveTest = !!tx.isLiveTest && !tx.liveTestEnded;
                    const netClass =
                      txType === 'sale' && !isPendingLiveTest ? styles.amountEarned :
                      txType === 'sale' && isPendingLiveTest ? styles.amountPending :
                      txType === 'withdrawal' || txType === 'prize_deduction' || txType === 'subscription' ? styles.amountOut :
                      txType === 'sponsored' && tx.amountEarned !== 0 ? styles.amountOut :
                      styles.amountNeutral;

                    return (
                      <tr key={i}>
                        <td>{tx.transactionDate ? format(new Date(tx.transactionDate), 'MMM dd, yyyy') : 'N/A'}</td>
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
                                <Clock size={12} />
                                Credited after the live test ends and prizes are paid
                              </span>
                            )}
                          </div>
                        </td>
                        <td className={styles.numeric}>
                          {txType === 'sponsored' ? `₹${tx.grossAmount.toFixed(2)} (commission)` : `₹${tx.grossAmount.toFixed(2)}`}
                        </td>
                        <td className={styles.numeric}>
                          {txType === 'withdrawal' || txType === 'prize_deduction' || txType === 'subscription' ? '—' : `${tx.platformFeePercentage.toFixed(0)}%`}
                        </td>
                        <td className={`${styles.numeric} ${netClass}`}>
                          {txType === 'sponsored' && tx.amountEarned === 0
                            ? '—'
                            : `₹${tx.amountEarned.toFixed(2)}`}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className={styles.emptyCell}>
                      Nothing in this date range. Widen the range to see more.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <BankDetailsDialog
          open={isBankDialogOpen}
          onOpenChange={setIsBankDialogOpen}
          existingDetails={bankDetails || null}
        />
      </div>
    </>
  );
};

export default TeacherReportsPage;
