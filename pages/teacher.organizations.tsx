import React, { useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import {
  Building2,
  Plus,
  Search,
  Check,
  X,
  LogOut,
  ExternalLink,
  Pencil,
  Users,
  Clock,
  Sparkles,
} from "lucide-react";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { TeacherListEmpty } from "../components/TeacherListEmpty";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Textarea } from "../components/Textarea";
import { Skeleton } from "../components/Skeleton";
import { Badge } from "../components/Badge";
import { Avatar, AvatarImage, AvatarFallback } from "../components/Avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../components/Dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/Select";
import { LocationPicker } from "../components/LocationPicker";
import { formatLocationString } from "../helpers/indianLocationsData";
import { getOrganizationProfilePath } from "../helpers/organizationRoutes";
import {
  OrganizationTypeValues,
  type OrganizationTypeValue,
} from "../endpoints/teacher/organizations/create_POST.schema";
import {
  useTeacherOrganizationsMineQuery,
  useCreateOrganizationMutation,
  useSearchOrganizationsQuery,
  useJoinRequestMutation,
  useRespondRequestMutation,
  useLeaveOrganizationMutation,
} from "../helpers/useTeacherOrganizations";
import styles from "./teacher.organizations.module.css";

const ORG_TYPE_LABELS: Record<OrganizationTypeValue, string> = {
  coaching: "Coaching institute",
  school: "School",
  college: "College",
  university: "University",
  other: "Other",
};

const STATUS_BADGE_VARIANT: Record<string, "success" | "warning" | "destructive"> = {
  approved: "success",
  pending: "warning",
  rejected: "destructive",
};

const formatDate = (value: Date | string) =>
  new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

const CreateOrganizationDialog: React.FC<{ open: boolean; onOpenChange: (open: boolean) => void }> = ({
  open,
  onOpenChange,
}) => {
  const [name, setName] = useState("");
  const [orgType, setOrgType] = useState<OrganizationTypeValue>("coaching");
  const [description, setDescription] = useState("");
  const [locState, setLocState] = useState("");
  const [locCity, setLocCity] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const createMutation = useCreateOrganizationMutation();

  const resetAndClose = () => {
    setName("");
    setOrgType("coaching");
    setDescription("");
    setLocState("");
    setLocCity("");
    setWebsiteUrl("");
    setFormError(null);
    onOpenChange(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      setFormError("Give your page a name with at least 2 characters.");
      return;
    }
    setFormError(null);
    try {
      await createMutation.mutateAsync({
        name: trimmedName,
        orgType,
        description: description.trim() || undefined,
        location: formatLocationString(locCity, locState) ?? undefined,
        websiteUrl: websiteUrl.trim() || undefined,
      });
      resetAndClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not create the organisation page.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(next) : resetAndClose())}>
      <DialogContent className={styles.dialogContent}>
        <DialogHeader>
          <DialogTitle>Create an organisation page</DialogTitle>
          <DialogDescription>
            It goes live instantly - no approval needed. Other teachers can later request to join it.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className={styles.form}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Name</span>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Horizon Coaching Centre"
              maxLength={120}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Type</span>
            <Select value={orgType} onValueChange={(v) => setOrgType(v as OrganizationTypeValue)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OrganizationTypeValues.map((value) => (
                  <SelectItem key={value} value={value}>
                    {ORG_TYPE_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Description (optional)</span>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 2000))}
              placeholder="What does this institute offer students?"
              rows={3}
            />
          </label>

          <div className={styles.field}>
            <span className={styles.fieldLabel}>Location (optional)</span>
            <LocationPicker state={locState} city={locCity} onChange={(next) => { setLocState(next.state); setLocCity(next.city); }} />
          </div>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Website (optional)</span>
            <Input
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://..."
              maxLength={300}
            />
          </label>

          {formError && <p className={styles.formError} role="alert">{formError}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={resetAndClose}>
              Cancel
            </Button>
            <Button type="submit" className={styles.ctaButton} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create page"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const JoinOrganizationSection: React.FC = () => {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const { data, isFetching } = useSearchOrganizationsQuery({ q: submittedQuery }, submittedQuery.length > 0);
  const joinMutation = useJoinRequestMutation();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittedQuery(query.trim());
  };

  return (
    <div className={styles.joinCard}>
      <h3 className={styles.sectionTitle}>Join an organisation</h3>
      <form onSubmit={handleSearch} className={styles.searchRow}>
        <div className={styles.searchInputWrap}>
          <Search size={16} className={styles.searchIcon} aria-hidden="true" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by institute name..."
            className={styles.searchInput}
          />
        </div>
        <Button type="submit" variant="outline" disabled={!query.trim()}>
          Search
        </Button>
      </form>

      {isFetching && <Skeleton style={{ height: "3.5rem", borderRadius: "1rem" }} />}

      {!isFetching && submittedQuery && (data?.results.length ?? 0) === 0 && (
        <p className={styles.emptyNote}>No organisations match "{submittedQuery}".</p>
      )}

      {!isFetching && data && data.results.length > 0 && (
        <ul className={styles.searchResults}>
          {data.results.map((org) => (
            <li key={org.id} className={styles.searchResultRow}>
              <Avatar className={styles.smallAvatar}>
                <AvatarImage src={org.logoUrl ?? undefined} alt="" />
                <AvatarFallback>
                  <Building2 size={16} />
                </AvatarFallback>
              </Avatar>
              <div className={styles.searchResultMeta}>
                <span className={styles.searchResultName}>{org.name}</span>
                <span className={styles.searchResultSub}>
                  {ORG_TYPE_LABELS[org.orgType]} · {org.teacherCount} {org.teacherCount === 1 ? "teacher" : "teachers"}
                </span>
              </div>
              {org.membershipStatus === "approved" ? (
                <Badge variant="success">Member</Badge>
              ) : org.membershipStatus === "pending" ? (
                <Badge variant="warning">Requested</Badge>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => joinMutation.mutate(org.id)}
                  disabled={joinMutation.isPending}
                >
                  Request to join
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const TeacherOrganizationsPage: React.FC = () => {
  const { data, isFetching, isError, error, refetch } = useTeacherOrganizationsMineQuery();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const respondMutation = useRespondRequestMutation();
  const leaveMutation = useLeaveOrganizationMutation();

  const organizations = data?.organizations ?? [];
  const pendingRequests = data?.pendingRequests ?? [];

  return (
    <>
      <Helmet>
        <title>Organisations - Testkart for Teachers</title>
        <meta name="description" content="Create or join an organisation page for your institute." />
      </Helmet>
      <div className={styles.page}>
        <ConsolePageHeader title="Organisations">
          <Button onClick={() => setIsCreateOpen(true)} className={styles.ctaButton}>
            <Plus size={16} aria-hidden="true" />
            Create organisation
          </Button>
        </ConsolePageHeader>

        <div className={styles.layout}>
          <div className={styles.main}>
            {isFetching && !data && (
              <div className={styles.list}>
                <Skeleton style={{ height: "6rem", borderRadius: "1.25rem" }} />
                <Skeleton style={{ height: "6rem", borderRadius: "1.25rem" }} />
              </div>
            )}

            {isError && (
              <TeacherListEmpty
                tone="error"
                title="Could not load your organisations"
                description={error instanceof Error ? error.message : "Try refreshing the page."}
              >
                <Button onClick={() => refetch()}>Try again</Button>
              </TeacherListEmpty>
            )}

            {!isFetching && !isError && organizations.length === 0 && (
              <TeacherListEmpty
                icon={<Building2 size={24} />}
                title="No organisation pages yet"
                description="Create a page for your coaching centre, school, college or university, or search for one to join."
              />
            )}

            {organizations.length > 0 && (
              <ul className={styles.list}>
                {organizations.map((org) => (
                  <li key={org.id} className={styles.orgCard}>
                    <Avatar className={styles.orgAvatar}>
                      <AvatarImage src={org.logoUrl ?? undefined} alt="" />
                      <AvatarFallback>
                        <Building2 size={20} />
                      </AvatarFallback>
                    </Avatar>
                    <div className={styles.orgMeta}>
                      <div className={styles.orgNameRow}>
                        <span className={styles.orgName}>{org.name}</span>
                        <Badge variant={STATUS_BADGE_VARIANT[org.membershipStatus]}>
                          {org.membershipStatus === "approved"
                            ? org.isCreator
                              ? "Creator"
                              : "Member"
                            : org.membershipStatus === "pending"
                              ? "Request pending"
                              : "Request declined"}
                        </Badge>
                      </div>
                      <span className={styles.orgSub}>
                        {ORG_TYPE_LABELS[org.orgType]} · {org.teacherCount} {org.teacherCount === 1 ? "teacher" : "teachers"}
                        {org.isCreator && org.pendingRequestCount > 0 && (
                          <> · {org.pendingRequestCount} pending request{org.pendingRequestCount === 1 ? "" : "s"}</>
                        )}
                      </span>
                    </div>
                    <div className={styles.orgActions}>
                      {org.membershipStatus === "approved" && (
                        <Button variant="outline" size="sm" asChild>
                          <Link to={getOrganizationProfilePath(org.orgType, org.slug)}>
                            <ExternalLink size={14} aria-hidden="true" />
                            View
                          </Link>
                        </Button>
                      )}
                      {org.isCreator && org.membershipStatus === "approved" && (
                        <Button variant="outline" size="sm" asChild>
                          <Link to={`/teacher/organizations/${org.id}/edit`}>
                            <Pencil size={14} aria-hidden="true" />
                            Edit
                          </Link>
                        </Button>
                      )}
                      {!org.isCreator && org.membershipStatus === "approved" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className={styles.leaveButton}
                          onClick={() => leaveMutation.mutate(org.id)}
                          disabled={leaveMutation.isPending}
                        >
                          <LogOut size={14} aria-hidden="true" />
                          Leave
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {pendingRequests.length > 0 && (
              <div className={styles.requestsCard}>
                <h3 className={styles.sectionTitle}>
                  <Clock size={16} aria-hidden="true" /> Pending join requests
                </h3>
                <ul className={styles.requestsList}>
                  {pendingRequests.map((req) => (
                    <li key={req.membershipId} className={styles.requestRow}>
                      <Avatar className={styles.smallAvatar}>
                        <AvatarImage src={req.teacherAvatarUrl ?? undefined} alt="" />
                        <AvatarFallback>{req.teacherName.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className={styles.requestMeta}>
                        <span className={styles.requestName}>{req.teacherName}</span>
                        <span className={styles.requestSub}>
                          wants to join {req.organizationName} · {formatDate(req.requestedAt)}
                        </span>
                      </div>
                      <div className={styles.requestActions}>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="outline"
                          aria-label="Approve"
                          onClick={() => respondMutation.mutate({ membershipId: req.membershipId, approve: true })}
                          disabled={respondMutation.isPending}
                        >
                          <Check size={14} />
                        </Button>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          aria-label="Reject"
                          onClick={() => respondMutation.mutate({ membershipId: req.membershipId, approve: false })}
                          disabled={respondMutation.isPending}
                        >
                          <X size={14} />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <aside className={styles.sidebar} aria-label="Join an organisation and tips">
            <JoinOrganizationSection />

            <div className={styles.tipCard}>
              <span className={styles.tipIcon} aria-hidden="true">
                <Sparkles size={16} />
              </span>
              <p>
                An organisation page shows every associated teacher, their study resources and community
                posts in one place, and students can follow it and leave an anonymous review.
              </p>
            </div>
          </aside>
        </div>
      </div>

      <CreateOrganizationDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
    </>
  );
};

export default TeacherOrganizationsPage;
