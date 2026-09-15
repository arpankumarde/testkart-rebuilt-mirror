import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import { SalesContactView } from "../endpoints/admin/sales/contacts_GET.schema";
import { 
  useAdminSalesContactsQuery, 
  useAdminSalesTeamQuery,
  useBulkAssignSalesContactsMutation,
  useSyncSalesContactsMutation
} from "../helpers/useAdminSalesContacts";
import { useAdminAuth } from "../helpers/useAdminAuth";
import { useDebounce } from "../helpers/useDebounce";
import { useListUrlParams } from "../helpers/useListUrlParams";
import { useRefetchOnLinkArrival } from "../helpers/useRefetchOnLinkArrival";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/Select";
import { RefreshCw, X } from "lucide-react";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { ConsoleListToolbar } from "../components/ConsoleListToolbar";
import { ConsoleListPagination } from "../components/ConsoleListPagination";
import { ConsoleFilterNotice } from "../components/ConsoleFilterNotice";
import {
  SalesStage,
  SalesStageArrayValues,
  SalesContactSource,
  SalesContactSourceArrayValues,
} from "../helpers/schema";
import { TeacherProfileDialog } from "../components/TeacherProfileDialog";
import { TeacherAdminView } from "../endpoints/admin/teachers/list_GET.schema";
import { AdminSalesList } from "../components/AdminSalesList";
import { STAGE_OPTIONS } from "../helpers/adminSalesUtils";
import styles from "./admin.sales.module.css";

const LIST_FILTERS = ["overdue"] as const;
type ListFilter = (typeof LIST_FILTERS)[number];

const mapContactToTeacherView = (contact: SalesContactView): TeacherAdminView => {
  return {
    // Website demo leads have no user account yet; AdminSalesList only offers
    // "View Profile" when userId is set, so this fallback is never rendered.
    id: contact.userId ?? 0,
    fullName: contact.displayName,
    email: contact.email || "Not given",
    mobileNumber: contact.mobileNumber,
    academyName: contact.academyName,
    createdAt: contact.signedUpAt,
    isActive: true,
    isVerified: false,
    testsCount: 0,
    bundlesCount: 0,
    coursesCount: 0,
    liveTestsCount: 0,
    productsCount: 0,
    totalEarnings: 0,
    onboardingCompleted: contact.onboardingCompleted,
    instituteType: null,
    location: contact.location,
    bio: contact.bio,
    tagline: contact.tagline,
    expertiseAreas: contact.expertiseAreas,
    languages: contact.languages,
    socialLinks: null,
    yearsOfExperience: null,
    teachingCategories: contact.teachingCategories,
    targetExams: contact.targetExams,
    teachingExperienceLevel: contact.teachingExperienceLevel,
    currentOccupation: contact.currentOccupation,
    goals: contact.goals,
    discoverySource: contact.discoverySource,
    schoolCollegeName: contact.schoolCollegeName,
    signupSource: contact.signupSource,
    productInterest: contact.productInterest,
    websiteUrl: null,
  };
};

const StatCardSkeleton = () => (
  <div className={styles.statCard}>
    <Skeleton style={{ height: '1rem', width: '80px', marginBottom: 'var(--spacing-2)' }} />
    <Skeleton style={{ height: '1.25rem', width: '40px' }} />
  </div>
);

const AdminSalesPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const { read, write } = useListUrlParams();
  const stageFilter = read<SalesStage | "__empty">("stage", SalesStageArrayValues, "__empty");
  const sourceFilter = read<SalesContactSource | "__empty">("source", SalesContactSourceArrayValues, "__empty");
  const listFilter = read<ListFilter | "none">("filter", LIST_FILTERS, "none");
  const openOverdueOnly = listFilter === "overdue";
  const [followUpFilter, setFollowUpFilter] = useState<"today" | "overdue" | "upcoming" | "unscheduled" | "__empty">("__empty");
  const [sortFilter, setSortFilter] = useState<"newest" | "follow_up_date" | "last_contacted">("newest");
  const [myLeads, setMyLeads] = useState<boolean>(false);
  const [assignedToFilter, setAssignedToFilter] = useState<string>("__empty"); // __empty, __unassigned, or ID
  const [signupDateFrom, setSignupDateFrom] = useState<string>("");
  const [signupDateTo, setSignupDateTo] = useState<string>("");
  
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  const [selectedContact, setSelectedContact] = useState<SalesContactView | null>(null);
  
  // Bulk Assign State
  const [selectedContactIds, setSelectedContactIds] = useState<Set<number>>(new Set());
  const [bulkAssignTo, setBulkAssignTo] = useState<string>("__empty");

  const { authState } = useAdminAuth();
  
  const { data: teamData } = useAdminSalesTeamQuery();
  const syncMutation = useSyncSalesContactsMutation();

  const assignedToNum = assignedToFilter === "__empty" ? undefined : assignedToFilter === "__unassigned" ? undefined : parseInt(assignedToFilter, 10);
  
  const { data, isFetching, isError, error, refetch } = useAdminSalesContactsQuery({
    page,
    search: debouncedSearchTerm,
    stage: stageFilter === "__empty" ? undefined : stageFilter,
    source: sourceFilter === "__empty" ? undefined : sourceFilter,
    followUpFilter: followUpFilter === "__empty" ? undefined : followUpFilter,
    sort: sortFilter,
    myLeads: myLeads ? "true" : "false",
    assignedTo: assignedToNum,
    signupDateFrom: signupDateFrom || undefined,
    signupDateTo: signupDateTo || undefined,
    openOverdue: openOverdueOnly || undefined,
  });
  useRefetchOnLinkArrival(stageFilter !== "__empty" || sourceFilter !== "__empty" || openOverdueOnly, isFetching, refetch);

  const bulkAssignMutation = useBulkAssignSalesContactsMutation();

  useEffect(() => {
    setPage(1);
    setSelectedContactIds(new Set());
  }, [debouncedSearchTerm, stageFilter, sourceFilter, followUpFilter, sortFilter, myLeads, assignedToFilter, signupDateFrom, signupDateTo, openOverdueOnly]);

  const toggleContactSelection = (contactId: number) => {
    setSelectedContactIds(prev => {
      const next = new Set(prev);
      if (next.has(contactId)) next.delete(contactId);
      else next.add(contactId);
      return next;
    });
  };

  const toggleAllSelection = () => {
    if (!data) return;
    if (selectedContactIds.size === data.contacts.length) {
      setSelectedContactIds(new Set());
    } else {
      setSelectedContactIds(new Set(data.contacts.map(c => c.id)));
    }
  };

  const handleBulkAssign = () => {
    if (selectedContactIds.size === 0 || bulkAssignTo === "__empty") return;
    const assignedToAdminId = bulkAssignTo === "__unassigned" ? null : parseInt(bulkAssignTo, 10);
    
    bulkAssignMutation.mutate({ 
      contactIds: Array.from(selectedContactIds),
      assignedToAdminId
    }, {
      onSuccess: () => {
        setSelectedContactIds(new Set());
        setBulkAssignTo("__empty");
      }
    });
  };

  const renderStats = () => {
    if (isFetching && !data) {
      return (
        <div className={styles.statsContainer}>
          {Array.from({ length: 7 }).map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
      );
    }

    if (!data) return null;

    const stats = [
      { label: "All leads", value: data.stats.total, colorClass: styles.statTotal },
      { label: "New", value: data.stats.new, colorClass: styles.statNew },
      { label: "Follow up", value: data.stats.followUp, colorClass: styles.statFollowUp },
      { label: "Qualified", value: data.stats.qualified, colorClass: styles.statQualified },
      { label: "Converted", value: data.stats.converted, colorClass: styles.statConverted },
      { label: "Not interested", value: data.stats.notInterested, colorClass: styles.statNotInterested },
      { label: "Demo requests", value: data.stats.demoRequests, colorClass: styles.statDemoRequests },
    ];

    return (
      <div className={styles.statsContainer}>
        {stats.map((stat, i) => (
          <div key={i} className={styles.statCard}>
            <div className={styles.statHeader}>
              <div className={`${styles.statDot} ${stat.colorClass}`} />
              <span className={styles.statLabel}>{stat.label}</span>
            </div>
            <span className={styles.statValue}>{stat.value.toLocaleString('en-IN')}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      <Helmet>
        <title>Sales pipeline - Testkart Admin</title>
        <meta name="description" content="Teacher leads and demo requests." />
      </Helmet>
      
      <div className={styles.page}>
        <ConsolePageHeader title="Sales pipeline">
          <div className={styles.headerActions}>
            <div className={styles.filtersGroup}>
              <Button 
                variant={!myLeads ? "primary" : "outline"} 
                onClick={() => setMyLeads(false)}
                className={styles.toggleBtnLeft}
              >
                All leads
              </Button>
              <Button 
                variant={myLeads ? "primary" : "outline"} 
                onClick={() => setMyLeads(true)}
                className={styles.toggleBtnRight}
              >
                My leads
              </Button>
            </div>

            <Button 
              variant="outline" 
              className={styles.syncBtn}
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
            >
              <RefreshCw size={16} className={syncMutation.isPending ? styles.spinIcon : ""} />
              Sync teachers
            </Button>
          </div>
        </ConsolePageHeader>

        <ConsoleListToolbar
          tabs={[
            { value: "__empty", label: "All stages" },
            ...STAGE_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label })),
          ]}
          value={stageFilter}
          onValueChange={(val) => write({ stage: val === "__empty" ? null : val })}
          tabsLabel="Lead stage"
          search={{
            value: searchTerm,
            onChange: setSearchTerm,
            placeholder: "Search by name",
            label: "Search leads",
          }}
        >
          <div className={styles.filterGroup}>
            <Select value={sourceFilter} onValueChange={(val) => write({ source: val === "__empty" ? null : val })}>
              <SelectTrigger className={styles.filterTrigger}>
                <SelectValue placeholder="All sources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__empty">All sources</SelectItem>
                <SelectItem value="demo_request">Demo requests</SelectItem>
                <SelectItem value="signup">Signups</SelectItem>
              </SelectContent>
            </Select>

            {!myLeads && (
              <Select value={assignedToFilter} onValueChange={setAssignedToFilter}>
                <SelectTrigger className={styles.filterTrigger}>
                  <SelectValue placeholder="Anyone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__empty">Anyone</SelectItem>
                  <SelectItem value="__unassigned">Unassigned</SelectItem>
                  {teamData?.team.map(member => (
                    <SelectItem key={member.id} value={member.id.toString()}>
                      {member.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select value={followUpFilter} onValueChange={(val) => setFollowUpFilter(val as any)}>
              <SelectTrigger className={styles.filterTrigger}>
                <SelectValue placeholder="Any follow-up" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__empty">Any follow-up</SelectItem>
                <SelectItem value="today">Due today</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="upcoming">Upcoming</SelectItem>
                <SelectItem value="unscheduled">Not scheduled</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortFilter} onValueChange={(val) => setSortFilter(val as any)}>
              <SelectTrigger className={styles.filterTrigger}>
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="follow_up_date">Follow-up date</SelectItem>
                <SelectItem value="last_contacted">Least recently contacted</SelectItem>
              </SelectContent>
            </Select>

            <div className={styles.dateFilterGroup}>
              <Input
                type="date"
                value={signupDateFrom}
                onChange={(e) => setSignupDateFrom(e.target.value)}
                className={styles.dateFilterInput}
                aria-label="Signed up from"
              />
              <span className={styles.dateFilterSeparator}>to</span>
              <Input
                type="date"
                value={signupDateTo}
                onChange={(e) => setSignupDateTo(e.target.value)}
                className={styles.dateFilterInput}
                aria-label="Signed up to"
              />
            </div>
          </div>
        </ConsoleListToolbar>

        {renderStats()}

        {openOverdueOnly && (
          <ConsoleFilterNotice
            label="Open leads with an overdue follow-up"
            count={data?.totalCount}
            onClear={() => write({ filter: null })}
            clearLabel="Show all"
          />
        )}

        <AdminSalesList 
          data={data}
          isFetching={isFetching}
          isError={isError}
          error={error}
          teamData={teamData}
          selectedContactIds={selectedContactIds}
          toggleContactSelection={toggleContactSelection}
          toggleAllSelection={toggleAllSelection}
          setSelectedContact={setSelectedContact}
          searchTerm={debouncedSearchTerm}
        />

        {data && data.totalPages > 1 && (
          <ConsoleListPagination
            page={data.currentPage}
            totalPages={data.totalPages}
            onPageChange={setPage}
          />
        )}

        {selectedContactIds.size > 0 && (
          <div className={styles.bulkActionBar}>
            <div className={styles.bulkActionContent}>
              <span className={styles.bulkCount}>{selectedContactIds.size} selected</span>
              
              <Select value={bulkAssignTo} onValueChange={setBulkAssignTo}>
                <SelectTrigger className={styles.bulkAssignTrigger}>
                  <SelectValue placeholder="Assign to" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__unassigned" className={styles.unassignedItem}>Unassigned</SelectItem>
                  {teamData?.team.map(member => (
                    <SelectItem key={member.id} value={member.id.toString()}>
                      {member.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Button 
                onClick={handleBulkAssign} 
                disabled={bulkAssignTo === "__empty" || bulkAssignMutation.isPending}
              >
                Assign
              </Button>
              
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setSelectedContactIds(new Set())}
                className={styles.closeBulkBtn}
                aria-label="Clear selection"
              >
                <X size={16} />
              </Button>
            </div>
          </div>
        )}

        <TeacherProfileDialog
          teacher={selectedContact ? mapContactToTeacherView(selectedContact) : null}
          onClose={() => setSelectedContact(null)}
          hideAccountStatus
        />
      </div>
    </>
  );
};

export default AdminSalesPage;