import React, { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import { toast } from "sonner";
import { useAdminSubscriptionsQuery } from "../helpers/useAdminSubscriptions";
import { useAdminCancelSubscription } from "../helpers/useAdminCancelSubscription";
import { useDebounce } from "../helpers/useDebounce";
import { useListUrlParams } from "../helpers/useListUrlParams";
import { useRefetchOnLinkArrival } from "../helpers/useRefetchOnLinkArrival";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { Skeleton } from "../components/Skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/Select";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/Tooltip";
import { AdminSubscriptionStats } from "../components/AdminSubscriptionStats";
import { AdminActiveTrials } from "../components/AdminActiveTrials";
import { AdminTrialHistory } from "../components/AdminTrialHistory";
import { FileText, AlertCircle, TimerOff, Ban } from "lucide-react";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { ConsoleListToolbar, consoleToolbarControlClass } from "../components/ConsoleListToolbar";
import { ConsoleListEmpty } from "../components/ConsoleListEmpty";
import { ConsoleListPagination } from "../components/ConsoleListPagination";
import { ConsoleConfirmDialog } from "../components/ConsoleConfirmDialog";
import { ConsoleFilterNotice } from "../components/ConsoleFilterNotice";
import { SubscriptionStatus, SubscriptionStatusArrayValues } from "../helpers/schema";
import { useAdminEndTrial } from "../helpers/adminSubscriptionsHooks";
import { StartTrialDialog } from "../components/StartTrialDialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/Tabs";
import { AdminSubscriptionPlansManager } from "../components/AdminSubscriptionPlansManager";
import { SubscriptionAdminView } from "../endpoints/admin/subscriptions/list_GET.schema";
import styles from "./admin.subscriptions.module.css";

/* Shared by the loading and loaded tables so the columns do not jump. */
const TableColumns = () => (
  <colgroup>
    <col />
    <col className={styles.colPlan} />
    <col className={styles.colStatus} />
    <col className={styles.colPeriod} />
    <col className={styles.colRenews} />
    <col className={styles.colDays} />
    <col className={styles.colActions} />
  </colgroup>
);

const StackSkeleton = ({ top, bottom }: { top: string; bottom: string }) => (
  <div className={styles.stack}>
    <Skeleton style={{ height: "0.875rem", width: top }} />
    <Skeleton style={{ height: "0.75rem", width: bottom }} />
  </div>
);

const SubscriptionRowSkeleton = () => (
  <tr>
    <td><StackSkeleton top="55%" bottom="75%" /></td>
    <td><StackSkeleton top="75%" bottom="50%" /></td>
    <td><Skeleton style={{ height: "1.125rem", width: "3.5rem" }} /></td>
    <td><StackSkeleton top="70%" bottom="85%" /></td>
    <td><StackSkeleton top="75%" bottom="80%" /></td>
    <td><Skeleton style={{ height: "0.875rem", width: "1.5rem", marginLeft: "auto" }} /></td>
    <td><Skeleton style={{ height: "1.5rem", width: "4rem", marginLeft: "auto" }} /></td>
  </tr>
);

const SubscriptionCardSkeleton = () => (
  <div className={styles.card}>
    <div className={styles.cardHeader}>
      <div className={styles.stack}>
        <Skeleton style={{ height: "1rem", width: "9rem", maxWidth: "100%" }} />
        <Skeleton style={{ height: "0.75rem", width: "12rem", maxWidth: "100%" }} />
      </div>
      <Skeleton style={{ height: "2rem", width: "4rem", flexShrink: 0 }} />
    </div>
    <div className={styles.cardStats}>
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} style={{ height: "2rem", width: "100%" }} />
      ))}
    </div>
  </div>
);

const EMPTY_PLAN_ID = "__empty";
const EMPTY_STATUS = "__empty";

const LIST_FILTERS = ["expiring-7d"] as const;
type ListFilter = (typeof LIST_FILTERS)[number];

const statusLabels: Record<SubscriptionStatus, string> = {
  active: "Active",
  expired: "Expired",
  cancelled: "Cancelled",
  pending: "Pending",
};

const AdminSubscriptionsPage: React.FC = () => {
  const [isStartTrialOpen, setIsStartTrialOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState<number | undefined>(undefined);
  const [selectedStatus, setSelectedStatus] = useState<SubscriptionStatus | undefined>(undefined);
  const [cancelTarget, setCancelTarget] = useState<{ id: number; name: string } | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [trialTarget, setTrialTarget] = useState<{ id: number; name: string } | null>(null);
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const { read, write } = useListUrlParams();
  const listFilter = read<ListFilter | "none">("filter", LIST_FILTERS, "none");
  const expiringSoonOnly = listFilter === "expiring-7d";

  const { data, isFetching, isError, error, refetch } = useAdminSubscriptionsQuery({
    page,
    search: debouncedSearchTerm,
    planId: selectedPlanId,
    status: selectedStatus,
    expiringWithin7Days: expiringSoonOnly || undefined,
  });
  useRefetchOnLinkArrival(expiringSoonOnly, isFetching, refetch);

  const queryClient = useQueryClient();
  const endTrial = useAdminEndTrial();
  const cancelSubscription = useAdminCancelSubscription();

  const confirmCancelSubscription = () => {
    if (!cancelTarget) return;
    cancelSubscription.mutate(
      { subscriptionId: cancelTarget.id, reason: cancelReason.trim() },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["admin", "subscriptions"] });
          queryClient.invalidateQueries({ queryKey: ["admin", "subscriptions", "active-trials"] });
          toast.success("Subscription cancelled.");
          setCancelTarget(null);
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Could not cancel this subscription.");
        }
      }
    );
  };

  const confirmEndTrial = () => {
    if (!trialTarget) return;
    endTrial.mutate(
      { subscriptionId: trialTarget.id },
      { onSuccess: () => setTrialTarget(null) }
    );
  };

  useEffect(() => {
    setPage(1);
  }, [debouncedSearchTerm, selectedPlanId, selectedStatus, expiringSoonOnly]);

  const formatDate = (date: Date | null): string => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    });
  };

  const getStatusVariant = (status: SubscriptionStatus) => {
    switch (status) {
      case "active": return "success";
      case "cancelled": return "destructive";
      case "expired": return "warning";
      case "pending": return "default";
      default: return "outline";
    }
  };

  const handlePlanChange = (value: string) => {
    setSelectedPlanId(value === EMPTY_PLAN_ID ? undefined : parseInt(value, 10));
  };

  const handleStatusChange = (value: string) => {
    setSelectedStatus(value === EMPTY_STATUS ? undefined : (value as SubscriptionStatus));
  };

  /* Only plans that have subscriptions. The backend already leaves the free plan out of the breakdown. */
  const planOptions = (data?.stats.planBreakdown ?? []).filter((p) => p.totalCount > 0);

  const renderStatus = (sub: SubscriptionAdminView) => (
    <Badge variant={getStatusVariant(sub.status)} className={styles.flag}>
      {statusLabels[sub.status] ?? sub.status}
    </Badge>
  );

  const renderIdentity = (sub: SubscriptionAdminView, showStatus = false) => (
    <div className={styles.stack}>
      <span className={styles.primaryLine}>
        <span className={styles.truncate} title={sub.teacherName}>{sub.teacherName}</span>
        {showStatus && renderStatus(sub)}
        {sub.isAdminTrial && (
          <Badge variant="warning" className={styles.flag}>Trial</Badge>
        )}
      </span>
      <span className={styles.secondaryLine} title={sub.teacherEmail ?? undefined}>
        {sub.teacherEmail ?? "Not given"}
      </span>
    </div>
  );

  const renderActions = (sub: SubscriptionAdminView) => (
    <div className={styles.rowActions}>
      {sub.isAdminTrial && sub.status === "active" && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-md"
              className={styles.iconButton}
              aria-label={`End trial for ${sub.teacherName}`}
              onClick={() => setTrialTarget({ id: sub.subscriptionId, name: sub.teacherName })}
              disabled={endTrial.isPending}
            >
              <TimerOff />
            </Button>
          </TooltipTrigger>
          <TooltipContent>End trial</TooltipContent>
        </Tooltip>
      )}
      {sub.status === "active" && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-md"
              className={`${styles.iconButton} ${styles.iconButtonDanger}`}
              aria-label={`Cancel subscription for ${sub.teacherName}`}
              onClick={() => { setCancelReason(""); setCancelTarget({ id: sub.subscriptionId, name: sub.teacherName }); }}
              disabled={cancelSubscription.isPending}
            >
              <Ban />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Cancel subscription</TooltipContent>
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
                {Array.from({ length: 10 }).map((_, i) => (
                  <SubscriptionRowSkeleton key={i} />
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.cardsContainer}>
            {Array.from({ length: 4 }).map((_, i) => (
              <SubscriptionCardSkeleton key={i} />
            ))}
          </div>
        </>
      );
    }

    if (isError) {
      return (
        <ConsoleListEmpty
          tone="error"
          icon={<AlertCircle size={24} />}
          title="Could not load the subscriptions"
          description={error instanceof Error ? error.message : "The request did not come back. Check your connection and try again."}
        >
          <Button variant="outline" onClick={() => refetch()}>Try again</Button>
        </ConsoleListEmpty>
      );
    }

    if (!data || data.subscriptions.length === 0) {
      const isFiltered = !!debouncedSearchTerm || !!selectedPlanId || !!selectedStatus || expiringSoonOnly;
      return (
        <ConsoleListEmpty
          icon={<FileText size={24} />}
          title={isFiltered ? "No subscriptions match these filters" : "No paid subscriptions yet"}
          description={
            isFiltered
              ? "Nothing here for this plan, status and search. Widen the filters to see the rest."
              : "Teachers who move off the free plan appear here."
          }
        >
          {isFiltered && (
            <Button
              variant="outline"
              onClick={() => {
                setSearchTerm("");
                setSelectedPlanId(undefined);
                setSelectedStatus(undefined);
                write({ filter: null });
              }}
            >
              Show all subscriptions
            </Button>
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
                <th>Teacher</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Started</th>
                <th>Renews</th>
                <th className={styles.num}>Days left</th>
                <th><span className={styles.srOnly}>Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {data.subscriptions.map((sub) => (
                <tr key={sub.subscriptionId}>
                  <td>{renderIdentity(sub)}</td>
                  <td>
                    <div className={styles.stack}>
                      <span className={styles.valueLine} title={sub.planName}>{sub.planName}</span>
                      <span className={styles.secondaryLine}>{sub.platformFeePercentage}% fee</span>
                    </div>
                  </td>
                  <td>{renderStatus(sub)}</td>
                  <td>
                    <div className={styles.stack}>
                      <span className={styles.valueLine}>{formatDate(sub.startDate)}</span>
                      <span className={styles.secondaryLine}>Ends {formatDate(sub.endDate)}</span>
                    </div>
                  </td>
                  <td>
                    <div className={styles.stack}>
                      <span className={styles.valueLine}>{formatDate(sub.nextRenewalDate)}</span>
                      <span className={styles.secondaryLine}>Auto-renew {sub.autoRenew ? "on" : "off"}</span>
                    </div>
                  </td>
                  <td className={`${styles.num} ${sub.daysUntilRenewal < 0 ? styles.zero : ""}`}>
                    {sub.daysUntilRenewal >= 0 ? sub.daysUntilRenewal : "-"}
                  </td>
                  <td>{renderActions(sub)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={styles.cardsContainer}>
          {data.subscriptions.map((sub) => (
            <article key={sub.subscriptionId} className={styles.card}>
              <div className={styles.cardHeader}>
                {renderIdentity(sub, true)}
                {renderActions(sub)}
              </div>
              {sub.adminNote && (
                <p className={styles.cardNote}>Note: {sub.adminNote}</p>
              )}
              <dl className={styles.cardStats}>
                <div className={styles.cardStat}>
                  <dt>Plan</dt>
                  <dd>{sub.planName}</dd>
                </div>
                <div className={styles.cardStat}>
                  <dt>Fee</dt>
                  <dd>{sub.platformFeePercentage}%</dd>
                </div>
                <div className={styles.cardStat}>
                  <dt>Started</dt>
                  <dd>{formatDate(sub.startDate)}</dd>
                </div>
                <div className={styles.cardStat}>
                  <dt>Ends</dt>
                  <dd>{formatDate(sub.endDate)}</dd>
                </div>
                <div className={styles.cardStat}>
                  <dt>Renews</dt>
                  <dd>{formatDate(sub.nextRenewalDate)}</dd>
                </div>
                <div className={styles.cardStat}>
                  <dt>Auto-renew</dt>
                  <dd>{sub.autoRenew ? "Yes" : "No"}</dd>
                </div>
                <div className={styles.cardStat}>
                  <dt>Days left</dt>
                  <dd className={sub.daysUntilRenewal < 0 ? styles.zero : undefined}>
                    {sub.daysUntilRenewal >= 0 ? sub.daysUntilRenewal : "-"}
                  </dd>
                </div>
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
        <title>Subscriptions - Testkart Admin</title>
        <meta
          name="description"
          content="Teacher subscriptions and plans on Testkart."
        />
      </Helmet>
      <div className={styles.page}>
        <ConsolePageHeader title="Subscriptions">
          <Button onClick={() => setIsStartTrialOpen(true)}>Start a trial</Button>
        </ConsolePageHeader>

        <StartTrialDialog open={isStartTrialOpen} onOpenChange={setIsStartTrialOpen} />

        <Tabs defaultValue="subscriptions" className={styles.tabsContainer}>
          <TabsList className={styles.tabsList}>
            <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
            <TabsTrigger value="settings">Plans</TabsTrigger>
          </TabsList>

          <TabsContent value="subscriptions" className={styles.tabContent}>
            <AdminSubscriptionStats
              stats={data?.stats}
              isFetching={isFetching}
            />

            <AdminActiveTrials />

            <AdminTrialHistory />

            <ConsoleListToolbar
              search={{
                value: searchTerm,
                onChange: setSearchTerm,
                placeholder: "Search by name or email",
                label: "Search subscriptions",
              }}
            >
              <Select
                value={selectedPlanId !== undefined ? String(selectedPlanId) : EMPTY_PLAN_ID}
                onValueChange={handlePlanChange}
              >
                <SelectTrigger className={consoleToolbarControlClass}>
                  <SelectValue placeholder="All plans" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={EMPTY_PLAN_ID}>All plans</SelectItem>
                  {planOptions.map((plan) => (
                    <SelectItem key={plan.planId} value={String(plan.planId)}>
                      {plan.planName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={selectedStatus ?? EMPTY_STATUS}
                onValueChange={handleStatusChange}
              >
                <SelectTrigger className={consoleToolbarControlClass}>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={EMPTY_STATUS}>All statuses</SelectItem>
                  {SubscriptionStatusArrayValues.map((status) => (
                    <SelectItem key={status} value={status}>
                      {statusLabels[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </ConsoleListToolbar>

            {expiringSoonOnly && (
              <ConsoleFilterNotice
                label="Active subscriptions ending in the next 7 days"
                count={data?.totalCount}
                onClear={() => write({ filter: null })}
                clearLabel="Show all"
              />
            )}

            <div className={styles.results}>{renderContent()}</div>

            {data && data.totalPages > 1 && (
              <ConsoleListPagination
                page={data.currentPage}
                totalPages={data.totalPages}
                onPageChange={setPage}
              />
            )}
          </TabsContent>

          <TabsContent value="settings" className={styles.tabContent}>
            <AdminSubscriptionPlansManager />
          </TabsContent>
        </Tabs>
      </div>

      <ConsoleConfirmDialog
        open={!!cancelTarget}
        onOpenChange={(open) => !open && setCancelTarget(null)}
        tone="destructive"
        title="Cancel this subscription?"
        description={`${cancelTarget?.name} moves back to the free plan and the higher platform fee applies from then on.`}
        confirmLabel="Cancel subscription"
        pendingLabel="Cancelling..."
        cancelLabel="Keep it"
        isPending={cancelSubscription.isPending}
        onConfirm={confirmCancelSubscription}
        note={{
          label: "Reason",
          value: cancelReason,
          onChange: setCancelReason,
          placeholder: "Moved to an annual plan",
          hint: "Optional. Only the team sees this.",
        }}
      />

      <ConsoleConfirmDialog
        open={!!trialTarget}
        onOpenChange={(open) => !open && setTrialTarget(null)}
        tone="destructive"
        title="End this trial now?"
        description={`${trialTarget?.name} goes back to their normal plan and fee straight away.`}
        confirmLabel="End trial"
        pendingLabel="Ending..."
        cancelLabel="Keep it running"
        isPending={endTrial.isPending}
        onConfirm={confirmEndTrial}
      />
    </>
  );
};

export default AdminSubscriptionsPage;
