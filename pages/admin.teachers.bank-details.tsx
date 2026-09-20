import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAdminBankDetailsQuery, useVerifyBankDetailsMutation } from "../helpers/useAdminBankDetails";
import { useDebounce } from "../helpers/useDebounce";
import { useListUrlParams } from "../helpers/useListUrlParams";
import { useRefetchOnLinkArrival } from "../helpers/useRefetchOnLinkArrival";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { Skeleton } from "../components/Skeleton";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { ConsoleListToolbar } from "../components/ConsoleListToolbar";
import { ConsoleListEmpty } from "../components/ConsoleListEmpty";
import { ConsoleListPagination } from "../components/ConsoleListPagination";
import {
  Dialog,
  DialogClose,
} from "../components/Dialog";
import {
  ConsoleDialogContent,
  ConsoleDialogHeader,
  ConsoleDialogBody,
  ConsoleDialogFooter,
} from "../components/ConsoleDialog";
import { ConsoleConfirmDialog } from "../components/ConsoleConfirmDialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/Tooltip";
import { Landmark, XCircle, BadgeCheck, AlertCircle, Eye } from "lucide-react";
import { toast } from "sonner";
import { BankDetailsAdminView, BankDetailsVerificationStatusFilterArray, TeacherBankDetailsSortColumn } from "../endpoints/admin/bank-details/list_GET.schema";
import { SortableTh } from "../components/SortableTh";
import type { SortOrder } from "../helpers/useTableSort";
import { BankVerificationStatus } from "../helpers/schema";
import styles from "./admin.teachers.bank-details.module.css";

const sentenceCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const STATUS_TABS = BankDetailsVerificationStatusFilterArray.map((status) => ({
  value: status,
  label: status === "all" ? "All" : sentenceCase(status),
}));

/* Shared by the loading and loaded tables so the columns do not jump. */
const TableColumns = () => (
  <colgroup>
    <col />
    <col className={styles.colAccount} />
    <col className={styles.colTax} />
    <col className={styles.colPanCard} />
    <col className={styles.colStatus} />
    <col className={styles.colDate} />
    <col className={styles.colActions} />
  </colgroup>
);

const StackSkeleton = ({ top, bottom }: { top: string; bottom: string }) => (
  <div className={styles.stack}>
    <Skeleton style={{ height: "0.875rem", width: top }} />
    <Skeleton style={{ height: "0.75rem", width: bottom }} />
  </div>
);

const DetailRowSkeleton = () => (
  <tr>
    <td><StackSkeleton top="60%" bottom="80%" /></td>
    <td><StackSkeleton top="70%" bottom="85%" /></td>
    <td><StackSkeleton top="75%" bottom="60%" /></td>
    <td><Skeleton style={{ height: "1.75rem", width: "2.75rem" }} /></td>
    <td><Skeleton style={{ height: "1.125rem", width: "4rem" }} /></td>
    <td><Skeleton style={{ height: "0.875rem", width: "5rem" }} /></td>
    <td><Skeleton style={{ height: "1.5rem", width: "5.5rem", marginLeft: "auto" }} /></td>
  </tr>
);

const DetailCardSkeleton = () => (
  <div className={styles.card}>
    <div className={styles.cardHeader}>
      <div className={styles.stack}>
        <Skeleton style={{ height: "1rem", width: "9rem", maxWidth: "100%" }} />
        <Skeleton style={{ height: "0.75rem", width: "12rem", maxWidth: "100%" }} />
      </div>
      <Skeleton style={{ height: "2rem", width: "6rem", flexShrink: 0 }} />
    </div>
    <div className={styles.cardStats}>
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} style={{ height: "2rem", width: "100%" }} />
      ))}
    </div>
  </div>
);

const rejectFormSchema = z.object({
  rejectionReason: z.string().min(10, "Give a reason of at least 10 characters so the teacher knows what to fix."),
});
type RejectFormValues = z.infer<typeof rejectFormSchema>;

const AdminBankDetailsPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const { read, write } = useListUrlParams();
  const statusFilter = read("status", BankDetailsVerificationStatusFilterArray, "all");
  const [selectedDetail, setSelectedDetail] = useState<BankDetailsAdminView | null>(null);
  const [dialogState, setDialogState] = useState<'view' | 'verify' | 'reject' | null>(null);
  const [sortBy, setSortBy] = useState<TeacherBankDetailsSortColumn | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  const { data, isFetching, isError, error, refetch } = useAdminBankDetailsQuery({
    page,
    search: debouncedSearchTerm,
    status: statusFilter,
    ...(sortBy ? { sortBy, sortOrder } : {}),
  });
  useRefetchOnLinkArrival(statusFilter !== "all", isFetching, refetch);

  /* Text starts A to Z; the submitted date starts with the newest. */
  const toggleSort = (column: TeacherBankDetailsSortColumn) => {
    setPage(1);
    if (column === sortBy) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(column);
    setSortOrder(column === "submitted" ? "desc" : "asc");
  };
  const sort = { sortBy, sortOrder, toggleSort };

  const verifyMutation = useVerifyBankDetailsMutation();

  const { register, handleSubmit, formState: { errors }, reset } = useForm<RejectFormValues>({
    resolver: zodResolver(rejectFormSchema),
  });

  useEffect(() => {
    setPage(1);
  }, [debouncedSearchTerm, statusFilter]);

  const openDialog = (state: 'view' | 'verify' | 'reject', detail: BankDetailsAdminView) => {
    setSelectedDetail(detail);
    setDialogState(state);
    if (state === 'reject') {
      reset({ rejectionReason: '' });
    }
  };

  const closeDialog = () => {
    setSelectedDetail(null);
    setDialogState(null);
  };

  const handleVerify = () => {
    if (!selectedDetail) return;
    verifyMutation.mutate(
      { teacherId: selectedDetail.teacherId, status: 'verified' },
      {
        onSuccess: () => {
          toast.success("Bank details verified.");
          closeDialog();
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Could not verify these details.");
        },
      }
    );
  };

  const handleReject = (values: RejectFormValues) => {
    if (!selectedDetail) return;
    verifyMutation.mutate(
      { teacherId: selectedDetail.teacherId, status: 'rejected', rejectionReason: values.rejectionReason },
      {
        onSuccess: () => {
          toast.success("Bank details rejected. The teacher has been notified.");
          closeDialog();
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Could not reject these details.");
        },
      }
    );
  };

  const formatDate = (date: Date | string | null): string => {
    if (!date) return "Not recorded";
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short', day: '2-digit', year: 'numeric',
    });
  };

  const maskAccountNumber = (accountNumber: string) => `****${accountNumber.slice(-4)}`;

  const getStatusBadgeVariant = (status: BankVerificationStatus) => {
    switch (status) {
      case 'verified': return 'success';
      case 'rejected': return 'destructive';
      case 'pending': return 'warning';
      default: return 'default';
    }
  };

  const isFiltered = debouncedSearchTerm !== "" || statusFilter !== "all";

  const clearFilters = () => {
    setSearchTerm("");
    write({ status: null });
  };

  const handleStatusChange = (value: string) => {
    setPage(1);
    write({ status: value === "all" ? null : value });
  };

  const renderStatusFlag = (detail: BankDetailsAdminView) => (
    <Badge variant={getStatusBadgeVariant(detail.verificationStatus)} className={styles.flag}>
      {sentenceCase(detail.verificationStatus)}
    </Badge>
  );

  const renderPanThumb = (detail: BankDetailsAdminView) =>
    detail.panCardImageBase64 ? (
      <button
        type="button"
        className={styles.panThumbButton}
        onClick={() => openDialog('view', detail)}
        aria-label={`View PAN card for ${detail.teacherName}`}
      >
        <img src={detail.panCardImageBase64} alt="" className={styles.panThumbnail} />
      </button>
    ) : (
      <span className={styles.emptyLine}>Not given</span>
    );

  const renderActions = (detail: BankDetailsAdminView) => (
    <div className={styles.rowActions}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-md"
            className={styles.iconButton}
            aria-label={`View bank details for ${detail.teacherName}`}
            onClick={() => openDialog('view', detail)}
          >
            <Eye />
          </Button>
        </TooltipTrigger>
        <TooltipContent>View details</TooltipContent>
      </Tooltip>
      {(detail.verificationStatus === 'pending' || detail.verificationStatus === 'rejected') && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-md"
              className={styles.iconButton}
              aria-label={`Verify bank details for ${detail.teacherName}`}
              onClick={() => openDialog('verify', detail)}
            >
              <BadgeCheck />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Verify</TooltipContent>
        </Tooltip>
      )}
      {(detail.verificationStatus === 'pending' || detail.verificationStatus === 'verified') && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-md"
              className={`${styles.iconButton} ${styles.iconButtonDanger}`}
              aria-label={`Reject bank details for ${detail.teacherName}`}
              onClick={() => openDialog('reject', detail)}
            >
              <XCircle />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Reject</TooltipContent>
        </Tooltip>
      )}
    </div>
  );

  const renderContent = () => {
    if (isFetching) {
      return (
        <>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <TableColumns />
              <tbody>
                {Array.from({ length: 10 }).map((_, i) => <DetailRowSkeleton key={i} />)}
              </tbody>
            </table>
          </div>
          <div className={styles.cardsContainer}>
            {Array.from({ length: 4 }).map((_, i) => <DetailCardSkeleton key={i} />)}
          </div>
        </>
      );
    }

    if (isError) {
      return (
        <ConsoleListEmpty
          tone="error"
          icon={<AlertCircle size={24} />}
          title="Could not load the bank details"
          description={error instanceof Error ? error.message : "The request did not come back. Check your connection and try again."}
        >
          <Button variant="outline" onClick={() => refetch()}>Try again</Button>
        </ConsoleListEmpty>
      );
    }

    if (!data || data.bankDetails.length === 0) {
      return (
        <ConsoleListEmpty
          icon={<Landmark size={24} />}
          title={isFiltered ? "No bank details match these filters" : "No bank details submitted yet"}
          description={
            isFiltered
              ? "Nothing here for this status and search. Widen the filters to see the rest."
              : "Teachers who add payout details for verification appear here."
          }
        >
          {isFiltered && (
            <Button variant="outline" onClick={clearFilters}>Show all bank details</Button>
          )}
        </ConsoleListEmpty>
      );
    }

    return (
      <>
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <TableColumns />
            <thead>
              <tr>
                <SortableTh column="name" sort={sort}>Teacher</SortableTh>
                <SortableTh column="bank" sort={sort}>Bank account</SortableTh>
                <th>PAN and UPI</th>
                <th>PAN card</th>
                <SortableTh column="status" sort={sort}>Status</SortableTh>
                <SortableTh column="submitted" sort={sort}>Submitted</SortableTh>
                <th><span className={styles.srOnly}>Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {data.bankDetails.map((detail) => (
                <tr key={detail.id}>
                  <td>
                    <div className={styles.stack}>
                      <span className={styles.primaryLine} title={detail.teacherName}>{detail.teacherName}</span>
                      <span className={styles.secondaryLine} title={detail.teacherEmail}>{detail.teacherEmail}</span>
                    </div>
                  </td>
                  <td>
                    <div className={styles.stack}>
                      <span className={styles.valueLine} title={detail.bankName}>{detail.bankName}</span>
                      <span className={styles.secondaryLine}>
                        {maskAccountNumber(detail.bankAccountNumber)}, {detail.bankIfscCode}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className={styles.stack}>
                      <span className={styles.valueLine}>{detail.panNumber}</span>
                      <span className={styles.secondaryLine} title={detail.upiId || undefined}>
                        {detail.upiId || "No UPI"}
                      </span>
                    </div>
                  </td>
                  <td>{renderPanThumb(detail)}</td>
                  <td>
                    <div className={styles.stack}>
                      {renderStatusFlag(detail)}
                      {detail.verificationStatus === 'rejected' && detail.rejectionReason && (
                        <span className={styles.secondaryLine} title={detail.rejectionReason}>
                          {detail.rejectionReason}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className={styles.date}>{formatDate(detail.updatedAt)}</td>
                  <td>{renderActions(detail)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={styles.cardsContainer}>
          {data.bankDetails.map((detail) => (
            <article key={detail.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.stack}>
                  <span className={styles.cardTitleLine}>
                    <span className={styles.truncate} title={detail.teacherName}>{detail.teacherName}</span>
                    {renderStatusFlag(detail)}
                  </span>
                  <span className={styles.secondaryLine} title={detail.teacherEmail}>{detail.teacherEmail}</span>
                </div>
                {renderActions(detail)}
              </div>
              {detail.verificationStatus === 'rejected' && detail.rejectionReason && (
                <p className={styles.cardReason}>Reason: {detail.rejectionReason}</p>
              )}
              <dl className={styles.cardStats}>
                <div className={styles.cardStat}><dt>Bank</dt><dd>{detail.bankName}</dd></div>
                <div className={styles.cardStat}><dt>Account</dt><dd>{maskAccountNumber(detail.bankAccountNumber)}</dd></div>
                <div className={styles.cardStat}><dt>IFSC</dt><dd>{detail.bankIfscCode}</dd></div>
                <div className={styles.cardStat}><dt>PAN</dt><dd>{detail.panNumber}</dd></div>
                <div className={styles.cardStat}><dt>UPI</dt><dd>{detail.upiId || "Not given"}</dd></div>
                <div className={styles.cardStat}><dt>Submitted</dt><dd>{formatDate(detail.updatedAt)}</dd></div>
                <div className={styles.cardStat}><dt>PAN card</dt><dd>{renderPanThumb(detail)}</dd></div>
              </dl>
            </article>
          ))}
        </div>
      </>
    );
  };

  return (
    <>
      <Helmet>
        <title>Bank details - Testkart Admin</title>
        <meta name="description" content="Teacher payout details awaiting verification." />
      </Helmet>
      <div className={styles.page}>
        <ConsolePageHeader title="Bank details" />

        <ConsoleListToolbar
          tabs={STATUS_TABS}
          value={statusFilter}
          onValueChange={handleStatusChange}
          tabsLabel="Verification status"
          search={{
            value: searchTerm,
            onChange: setSearchTerm,
            placeholder: "Search by name, email or bank",
            label: "Search bank details",
          }}
        />

        <div className={styles.results}>{renderContent()}</div>

        {data && data.totalPages > 1 && (
          <ConsoleListPagination
            page={data.currentPage}
            totalPages={data.totalPages}
            onPageChange={setPage}
          />
        )}
      </div>

      <Dialog open={dialogState === 'view' && !!selectedDetail} onOpenChange={(open) => !open && closeDialog()}>
        <ConsoleDialogContent size="xl">
          <ConsoleDialogHeader
            title={`Bank details for ${selectedDetail?.teacherName ?? ""}`}
            description={selectedDetail?.teacherEmail}
          >
            {selectedDetail && (
              <div className={styles.headerBadges}>
                <Badge variant={getStatusBadgeVariant(selectedDetail.verificationStatus)}>
                  {sentenceCase(selectedDetail.verificationStatus)}
                </Badge>
              </div>
            )}
          </ConsoleDialogHeader>
          {selectedDetail && (
            <ConsoleDialogBody>
              {selectedDetail.verificationStatus === 'rejected' && selectedDetail.rejectionReason && (
                <p className={styles.rejectionCallout}>
                  <strong>Rejection reason:</strong> {selectedDetail.rejectionReason}
                </p>
              )}
              <div className={styles.viewLayout}>
                <section className={styles.dialogBlock}>
                  <h3 className={styles.dialogBlockTitle}>Account</h3>
                  <dl className={styles.detailsGrid}>
                    <div className={styles.detailItem}>
                      <dt>Bank</dt>
                      <dd>{selectedDetail.bankName}</dd>
                    </div>
                    <div className={styles.detailItem}>
                      <dt>Account holder</dt>
                      <dd>{selectedDetail.bankAccountHolderName}</dd>
                    </div>
                    <div className={styles.detailItem}>
                      <dt>Account number</dt>
                      <dd>{selectedDetail.bankAccountNumber}</dd>
                    </div>
                    <div className={styles.detailItem}>
                      <dt>IFSC code</dt>
                      <dd>{selectedDetail.bankIfscCode}</dd>
                    </div>
                    <div className={styles.detailItem}>
                      <dt>PAN number</dt>
                      <dd>{selectedDetail.panNumber}</dd>
                    </div>
                    <div className={styles.detailItem}>
                      <dt>UPI</dt>
                      <dd>{selectedDetail.upiId || 'Not given'}</dd>
                    </div>
                  </dl>
                </section>
                <section className={styles.dialogBlock}>
                  <h3 className={styles.dialogBlockTitle}>PAN card</h3>
                  {selectedDetail.panCardImageBase64 ? (
                    <img
                      src={selectedDetail.panCardImageBase64}
                      alt={`PAN card for ${selectedDetail.teacherName}`}
                      className={styles.fullPanImage}
                    />
                  ) : (
                    <p className={styles.naText}>No image uploaded</p>
                  )}
                </section>
              </div>
            </ConsoleDialogBody>
          )}
        </ConsoleDialogContent>
      </Dialog>

      <ConsoleConfirmDialog
        open={dialogState === 'verify' && !!selectedDetail}
        onOpenChange={(open) => !open && closeDialog()}
        title="Verify these bank details?"
        description={
          selectedDetail ? (
            <>Payouts to <strong>{selectedDetail.teacherName}</strong> will be enabled once verified.</>
          ) : undefined
        }
        icon={<BadgeCheck size={20} />}
        confirmLabel="Verify bank details"
        pendingLabel="Verifying..."
        isPending={verifyMutation.isPending}
        onConfirm={handleVerify}
      />

      <Dialog open={dialogState === 'reject' && !!selectedDetail} onOpenChange={(open) => !open && closeDialog()}>
        <ConsoleDialogContent size="sm">
          <ConsoleDialogHeader
            title="Reject these bank details?"
            description={
              <>Say what is wrong so <strong>{selectedDetail?.teacherName}</strong> can fix it. They will see this reason.</>
            }
            icon={<XCircle size={20} />}
            tone="destructive"
          />
          <form onSubmit={handleSubmit(handleReject)}>
            <ConsoleDialogBody>
              <div className={styles.formGroup}>
                <label htmlFor="rejectionReason">Reason</label>
                <textarea
                  id="rejectionReason"
                  {...register("rejectionReason")}
                  className={styles.textarea}
                  rows={4}
                  placeholder="The PAN card image is too blurry to read"
                />
                {errors.rejectionReason && <p className={styles.errorMessage}>{errors.rejectionReason.message}</p>}
              </div>
            </ConsoleDialogBody>
            <ConsoleDialogFooter>
              <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
              <Button type="submit" variant="destructive" disabled={verifyMutation.isPending}>
                {verifyMutation.isPending ? "Rejecting..." : "Reject bank details"}
              </Button>
            </ConsoleDialogFooter>
          </form>
        </ConsoleDialogContent>
      </Dialog>
    </>
  );
};

export default AdminBankDetailsPage;
