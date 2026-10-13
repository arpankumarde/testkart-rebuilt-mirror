import React, { useState } from "react";
import { Helmet } from "react-helmet";
import { Link, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  ExternalLink,
  Eye,
  EyeOff,
  Heart,
  ImageOff,
  LogIn,
  Megaphone,
  MessageSquareText,
  Star,
  Users,
} from "lucide-react";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { Skeleton } from "../components/Skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "../components/Avatar";
import { VerifiedBadge } from "../components/VerifiedBadge";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { ConsoleListToolbar, consoleToolbarControlClass } from "../components/ConsoleListToolbar";
import { ConsoleListEmpty } from "../components/ConsoleListEmpty";
import { ConsoleConfirmDialog } from "../components/ConsoleConfirmDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/Select";
import { useAdminOrganizationQuery, useSetOrganizationActiveMutation } from "../helpers/useAdminOrganizations";
import { useImpersonateMutation } from "../helpers/useImpersonation";
import { getOrganizationProfilePath } from "../helpers/organizationRoutes";
import { ADMIN_ORG_TYPE_LABELS, formatAdminDate } from "../helpers/adminOrganizationLabels";
import { sanitizeHtml } from "../helpers/sanitizeHtml";
import type {
  AdminOrganizationResource,
  AdminOrganizationResourceKind,
  OutputType,
} from "../endpoints/admin/organizations/get_GET.schema";
import styles from "./admin.organizations.$organizationId.module.css";

type DetailTab = "overview" | "teachers" | "resources" | "reviews" | "posts" | "gallery";

const RESOURCE_LABELS: Record<AdminOrganizationResourceKind, string> = {
  course: "Course",
  bundle: "Bundle",
  test: "Mock test",
  live_test: "Live test",
  product: "Study notes",
};

const INSTITUTE_SIZE_LABELS: Record<string, string> = {
  "1-10": "1-10 people",
  "11-50": "11-50 people",
  "51-200": "51-200 people",
  "201-500": "201-500 people",
  "501-1000": "501-1,000 people",
  "1000+": "1,000+ people",
};

const STATUS_VARIANTS = { approved: "success", pending: "warning", rejected: "destructive" } as const;

const resourceLink = (item: AdminOrganizationResource): string => {
  switch (item.kind) {
    case "course":
      return `/course/${item.slug}`;
    case "bundle":
      return `/bundles/${item.slug}`;
    case "test":
      return `/mock-test/${item.slug}`;
    case "live_test":
      return `/mock-test/live/${item.id}`;
    case "product":
      return `/study-notes/${item.slug}`;
  }
};

const formatRupees = (amount: number) => (amount === 0 ? "Free" : `₹${amount.toLocaleString("en-IN")}`);

const DetailSkeleton = () => (
  <div className={styles.page} aria-busy="true">
    <Skeleton style={{ height: "1rem", width: "8rem" }} />
    <Skeleton style={{ height: "2rem", width: "18rem", maxWidth: "100%" }} />
    <Skeleton style={{ height: "8rem", width: "100%", borderRadius: "var(--radius-md)" }} />
    <Skeleton style={{ height: "2.75rem", width: "100%", borderRadius: "var(--radius-md)" }} />
    <Skeleton style={{ height: "16rem", width: "100%", borderRadius: "var(--radius-md)" }} />
  </div>
);

const DetailRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className={styles.detailRow}>
    <dt>{label}</dt>
    <dd>{children}</dd>
  </div>
);

const Empty = ({ children }: { children: React.ReactNode }) => <span className={styles.muted}>{children}</span>;

const OverviewTab: React.FC<{ data: OutputType }> = ({ data }) => {
  const { organization: org, owner } = data;
  const socialEntries = Object.entries(org.socialLinks ?? {});
  return (
    <div className={styles.overviewGrid}>
      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>About</h2>
        {org.description ? (
          <div className={styles.description} dangerouslySetInnerHTML={{ __html: sanitizeHtml(org.description) }} />
        ) : (
          <p className={styles.muted}>No description added.</p>
        )}
        {org.specialties.length > 0 && (
          <div className={styles.chips}>
            {org.specialties.map((specialty) => (
              <Badge key={specialty} variant="secondary">{specialty}</Badge>
            ))}
          </div>
        )}
      </section>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Details</h2>
        <dl className={styles.detailList}>
          <DetailRow label="Type">{ADMIN_ORG_TYPE_LABELS[org.orgType]}</DetailRow>
          <DetailRow label="Location">{org.location || <Empty>Not added</Empty>}</DetailRow>
          <DetailRow label="Phone">
            {org.phoneNumber ? <a href={`tel:${org.phoneNumber}`}>{org.phoneNumber}</a> : <Empty>Not added</Empty>}
          </DetailRow>
          <DetailRow label="Website">
            {org.websiteUrl ? (
              <a href={org.websiteUrl} target="_blank" rel="noreferrer">
                {org.websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}
              </a>
            ) : (
              <Empty>Not added</Empty>
            )}
          </DetailRow>
          <DetailRow label="Founded">{org.foundedYear ?? <Empty>Not added</Empty>}</DetailRow>
          <DetailRow label="Size">
            {org.instituteSize ? INSTITUTE_SIZE_LABELS[org.instituteSize] ?? org.instituteSize : <Empty>Not added</Empty>}
          </DetailRow>
          <DetailRow label="Social">
            {socialEntries.length > 0 ? (
              <span className={styles.inlineLinks}>
                {socialEntries.map(([network, href]) => (
                  <a key={network} href={href} target="_blank" rel="noreferrer">
                    {network.charAt(0).toUpperCase() + network.slice(1)}
                  </a>
                ))}
              </span>
            ) : (
              <Empty>None</Empty>
            )}
          </DetailRow>
          <DetailRow label="Public page">
            <a href={getOrganizationProfilePath(org.orgType, org.slug)} target="_blank" rel="noreferrer">
              {getOrganizationProfilePath(org.orgType, org.slug)}
            </a>
          </DetailRow>
          <DetailRow label="Owner">
            <span className={styles.stack}>
              <span>
                {owner.name}
                {!owner.isActive && <Badge variant="destructive" className={styles.flag}>Inactive</Badge>}
              </span>
              {owner.email && <span className={styles.muted}>{owner.email}</span>}
              {owner.mobileNumber && <span className={styles.muted}>{owner.mobileNumber}</span>}
            </span>
          </DetailRow>
          <DetailRow label="Registered">{formatAdminDate(org.createdAt)}</DetailRow>
          <DetailRow label="Last updated">{formatAdminDate(org.updatedAt)}</DetailRow>
        </dl>
      </section>
    </div>
  );
};

const TeachersTab: React.FC<{ data: OutputType }> = ({ data }) => {
  if (data.members.length === 0) {
    return <ConsoleListEmpty icon={<Users size={24} />} title="No teachers yet" description="Teachers who join this organization will be listed here." />;
  }
  return (
    <div className={styles.tableContainer}>
      <table className={styles.table}>
        <colgroup>
          <col />
          <col className={styles.colStatus} />
          <col className={styles.colDate} />
          <col className={styles.colDate} />
          <col className={styles.colLink} />
        </colgroup>
        <thead>
          <tr>
            <th>Teacher</th>
            <th>Status</th>
            <th>Requested</th>
            <th>Responded</th>
            <th><span className={styles.srOnly}>Profile</span></th>
          </tr>
        </thead>
        <tbody>
          {data.members.map((member) => (
            <tr key={member.membershipId}>
              <td>
                <div className={styles.identity}>
                  <Avatar className={styles.avatar}>
                    <AvatarImage src={member.avatarUrl ?? undefined} alt="" />
                    <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className={styles.stack}>
                    <span className={styles.primaryLine}>
                      <span className={styles.truncate}>{member.name}</span>
                      <VerifiedBadge isVerified={member.isVerified} size="sm" />
                      {member.isOwner && <Badge variant="lavender" className={styles.flag}>Owner</Badge>}
                    </span>
                    <span className={styles.secondaryLine}>{member.email ?? "No email"}</span>
                  </div>
                </div>
              </td>
              <td>
                <Badge variant={STATUS_VARIANTS[member.status]} className={styles.flag}>
                  {member.status.charAt(0).toUpperCase() + member.status.slice(1)}
                </Badge>
              </td>
              <td className={styles.date}>{formatAdminDate(member.requestedAt)}</td>
              <td className={styles.date}>{member.respondedAt ? formatAdminDate(member.respondedAt) : <Empty>Waiting</Empty>}</td>
              <td className={styles.linkCell}>
                {member.slug && (
                  <a href={`/expert/${member.slug}`} target="_blank" rel="noreferrer" className={styles.textLink}>
                    Profile <ExternalLink aria-hidden="true" />
                  </a>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const ResourcesTab: React.FC<{ data: OutputType }> = ({ data }) => {
  const [kind, setKind] = useState<"all" | AdminOrganizationResourceKind>("all");
  const items = kind === "all" ? data.resources : data.resources.filter((r) => r.kind === kind);
  const kindsPresent = (Object.keys(RESOURCE_LABELS) as AdminOrganizationResourceKind[]).filter((k) =>
    data.resources.some((r) => r.kind === k)
  );

  if (data.resources.length === 0) {
    return (
      <ConsoleListEmpty
        icon={<Building2 size={24} />}
        title="No published resources"
        description="Courses, bundles, mock tests and study notes published by approved teachers show here."
      />
    );
  }

  return (
    <div className={styles.sectionStack}>
      <div className={styles.filterRow}>
        <span className={styles.muted}>Published by approved teachers, as listed on the public page.</span>
        <Select value={kind} onValueChange={(value) => setKind(value as typeof kind)}>
          <SelectTrigger className={consoleToolbarControlClass} aria-label="Filter resources by type">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types ({data.resources.length})</SelectItem>
            {kindsPresent.map((k) => (
              <SelectItem key={k} value={k}>
                {RESOURCE_LABELS[k]} ({data.resources.filter((r) => r.kind === k).length})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <colgroup>
            <col />
            <col className={styles.colStatus} />
            <col className={styles.colTeacher} />
            <col className={styles.colPrice} />
            <col className={styles.colDate} />
            <col className={styles.colLink} />
          </colgroup>
          <thead>
            <tr>
              <th>Title</th>
              <th>Type</th>
              <th>Teacher</th>
              <th className={styles.num}>Price</th>
              <th>Added</th>
              <th><span className={styles.srOnly}>Open</span></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={`${item.kind}-${item.id}`}>
                <td><span className={styles.truncate} title={item.title}>{item.title}</span></td>
                <td><Badge variant="outline" className={styles.flag}>{RESOURCE_LABELS[item.kind]}</Badge></td>
                <td className={styles.truncate} title={item.teacherName}>{item.teacherName}</td>
                <td className={styles.num}>
                  {item.discountPrice !== null && <s className={styles.muted}>{formatRupees(item.price)}</s>}{" "}
                  {formatRupees(item.discountPrice ?? item.price)}
                </td>
                <td className={styles.date}>{formatAdminDate(item.createdAt)}</td>
                <td className={styles.linkCell}>
                  <a href={resourceLink(item)} target="_blank" rel="noreferrer" className={styles.textLink}>
                    Open <ExternalLink aria-hidden="true" />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ReviewsTab: React.FC<{ data: OutputType }> = ({ data }) => {
  const { reviews } = data;
  if (reviews.count === 0) {
    return <ConsoleListEmpty icon={<MessageSquareText size={24} />} title="No reviews yet" description="Student reviews of this organization will show here." />;
  }
  return (
    <div className={styles.sectionStack}>
      <section className={`${styles.panel} ${styles.reviewSummary}`}>
        <div className={styles.score}>
          <span className={styles.scoreValue}>{reviews.averageRating?.toFixed(1) ?? "-"}</span>
          <span className={styles.muted}>{reviews.count} {reviews.count === 1 ? "review" : "reviews"}</span>
        </div>
        <ul className={styles.bars} aria-label="Rating breakdown">
          {reviews.distribution.map(({ stars, count }) => (
            <li key={stars} className={styles.barRow} aria-label={`${stars} stars: ${count}`}>
              <span aria-hidden="true">{stars} <Star className={styles.barStar} /></span>
              <span className={styles.barTrack} aria-hidden="true">
                <span className={styles.barFill} style={{ width: `${Math.round((count / reviews.count) * 100)}%` }} />
              </span>
              <span className={styles.barCount} aria-hidden="true">{count}</span>
            </li>
          ))}
        </ul>
      </section>
      <p className={styles.muted}>Reviews are anonymous on the site, so reviewers are not shown here either. Latest {reviews.latest.length} shown.</p>
      <ul className={styles.list}>
        {reviews.latest.map((review) => (
          <li key={review.id} className={styles.listItem}>
            <div className={styles.listHead}>
              <span className={styles.stars} aria-label={`${review.rating} out of 5`}>
                {"★".repeat(review.rating)}
                <span className={styles.starsEmpty}>{"★".repeat(5 - review.rating)}</span>
              </span>
              <span className={styles.muted}>{formatAdminDate(review.createdAt)}</span>
            </div>
            {review.reviewText ? <p className={styles.listText}>{review.reviewText}</p> : <Empty>Rating only</Empty>}
          </li>
        ))}
      </ul>
    </div>
  );
};

const PostsTab: React.FC<{ data: OutputType }> = ({ data }) => {
  if (data.posts.length === 0) {
    return <ConsoleListEmpty icon={<Megaphone size={24} />} title="No posts yet" description="Community posts by approved teachers show here." />;
  }
  return (
    <ul className={styles.list}>
      {data.posts.map((post) => (
        <li key={post.id} className={`${styles.listItem} ${styles.postItem}`}>
          {post.imageUrl ? (
            <a href={post.imageUrl} target="_blank" rel="noreferrer" className={styles.postThumb}>
              <img src={post.imageUrl} alt="" loading="lazy" />
            </a>
          ) : (
            <span className={`${styles.postThumb} ${styles.postThumbEmpty}`} aria-hidden="true"><ImageOff /></span>
          )}
          <div className={styles.stack}>
            <div className={styles.listHead}>
              <strong>{post.teacherName}</strong>
              <span className={styles.muted}>{formatAdminDate(post.createdAt)}</span>
              <span className={styles.likes}><Heart aria-hidden="true" /> {post.likeCount}</span>
            </div>
            <p className={styles.listText}>{post.body}</p>
          </div>
        </li>
      ))}
    </ul>
  );
};

const GalleryTab: React.FC<{ data: OutputType }> = ({ data }) => {
  if (data.gallery.length === 0) {
    return <ConsoleListEmpty icon={<ImageOff size={24} />} title="No gallery items" description="Photos and videos the owner adds show here." />;
  }
  return (
    <div className={styles.gallery}>
      {data.gallery.map((item) => (
        <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className={styles.galleryItem} title={item.caption ?? undefined}>
          {item.mediaType === "photo" ? (
            <img src={item.url} alt={item.caption ?? ""} loading="lazy" />
          ) : (
            <span className={styles.videoTile}>Video</span>
          )}
        </a>
      ))}
    </div>
  );
};

const AdminOrganizationDetailPage: React.FC = () => {
  const { organizationId } = useParams<{ organizationId: string }>();
  const id = organizationId && /^\d+$/.test(organizationId) ? Number(organizationId) : null;
  const [tab, setTab] = useState<DetailTab>("overview");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { data, isPending, isError, error, refetch } = useAdminOrganizationQuery(id);
  const setActiveMutation = useSetOrganizationActiveMutation();
  const impersonateMutation = useImpersonateMutation();

  const backLink = (
    <Link to="/admin/organizations" className={styles.backLink}>
      <ArrowLeft aria-hidden="true" /> Organizations
    </Link>
  );

  if (id === null || (isError && /not found|404/i.test(error?.message ?? ""))) {
    return (
      <div className={styles.page}>
        {backLink}
        <ConsoleListEmpty icon={<Building2 size={24} />} title="Organization not found" description="It may have been removed, or the link is wrong." />
      </div>
    );
  }

  if (isPending) return <DetailSkeleton />;

  if (isError || !data) {
    return (
      <div className={styles.page}>
        {backLink}
        <ConsoleListEmpty
          tone="error"
          icon={<AlertCircle size={24} />}
          title="Could not load this organization"
          description={error instanceof Error ? error.message : "The request did not come back. Try again."}
        >
          <Button variant="outline" onClick={() => refetch()}>Try again</Button>
        </ConsoleListEmpty>
      </div>
    );
  }

  const { organization: org } = data;
  const approved = data.members.filter((m) => m.status === "approved").length;
  const pending = data.members.filter((m) => m.status === "pending").length;

  const tabs: { value: DetailTab; label: string; count?: number }[] = [
    { value: "overview", label: "Overview" },
    { value: "teachers", label: "Teachers", count: data.members.length },
    { value: "resources", label: "Resources", count: data.resources.length },
    { value: "reviews", label: "Reviews", count: data.reviews.count },
    { value: "posts", label: "Posts", count: data.posts.length },
    { value: "gallery", label: "Gallery", count: data.gallery.length },
  ];

  return (
    <>
      <Helmet>
        <title>{`${org.name} - Organizations - Testkart Admin`}</title>
      </Helmet>
      <div className={styles.page}>
        {backLink}
        <ConsolePageHeader title={org.name}>
          <Button variant="outline" size="sm" asChild>
            <a href={getOrganizationProfilePath(org.orgType, org.slug)} target="_blank" rel="noreferrer">
              <ExternalLink /> Public page
            </a>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => impersonateMutation.mutate({ userId: data.owner.id })}
            disabled={impersonateMutation.isPending || !data.owner.isActive}
          >
            <LogIn /> Log in as owner
          </Button>
          <Button
            variant={org.isActive ? "outline" : "primary"}
            size="sm"
            className={org.isActive ? styles.dangerButton : undefined}
            onClick={() => setConfirmOpen(true)}
            disabled={setActiveMutation.isPending}
          >
            {org.isActive ? <><EyeOff /> Hide from site</> : <><Eye /> Show on site</>}
          </Button>
        </ConsolePageHeader>

        <section className={styles.summary}>
          {org.coverImageUrl && <img src={org.coverImageUrl} alt="" className={styles.cover} />}
          <div className={styles.summaryBody}>
            <Avatar className={styles.summaryLogo}>
              <AvatarImage src={org.logoUrl ?? undefined} alt="" />
              <AvatarFallback><Building2 size={22} /></AvatarFallback>
            </Avatar>
            <div className={styles.stack}>
              <span className={styles.summaryTitle}>
                {org.name}
                <Badge variant="outline" className={styles.flag}>{ADMIN_ORG_TYPE_LABELS[org.orgType]}</Badge>
                {org.isActive ? (
                  <Badge variant="success" className={styles.flag}>Visible</Badge>
                ) : (
                  <Badge variant="warning" className={styles.flag}>Hidden</Badge>
                )}
              </span>
              <span className={styles.muted}>{[org.location, `/${org.slug}`].filter(Boolean).join(" · ")}</span>
            </div>
          </div>
          <dl className={styles.stats}>
            <div><dt>Teachers</dt><dd>{approved}</dd></div>
            <div><dt>Pending</dt><dd className={pending === 0 ? styles.muted : undefined}>{pending}</dd></div>
            <div><dt>Resources</dt><dd>{data.resources.length}</dd></div>
            <div><dt>Followers</dt><dd>{data.followersCount}</dd></div>
            <div>
              <dt>Rating</dt>
              <dd>{data.reviews.averageRating !== null ? `${data.reviews.averageRating.toFixed(1)} (${data.reviews.count})` : <Empty>None</Empty>}</dd>
            </div>
            <div><dt>Registered</dt><dd>{formatAdminDate(org.createdAt)}</dd></div>
          </dl>
        </section>

        <ConsoleListToolbar
          tabs={tabs}
          value={tab}
          onValueChange={(value) => setTab(value as DetailTab)}
          tabsLabel="Organization sections"
          panelId="organization-section"
        />

        <div id="organization-section" role="tabpanel" aria-labelledby={`organization-section-tab-${tab}`}>
          {tab === "overview" && <OverviewTab data={data} />}
          {tab === "teachers" && <TeachersTab data={data} />}
          {tab === "resources" && <ResourcesTab data={data} />}
          {tab === "reviews" && <ReviewsTab data={data} />}
          {tab === "posts" && <PostsTab data={data} />}
          {tab === "gallery" && <GalleryTab data={data} />}
        </div>
      </div>

      <ConsoleConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        tone={org.isActive ? "destructive" : "default"}
        icon={org.isActive ? <EyeOff size={20} /> : <Eye size={20} />}
        title={org.isActive ? "Hide this organization from the site?" : "Show this organization on the site?"}
        description={
          org.isActive
            ? `${org.name}'s public page stops loading for visitors. Its teachers, their content and the owner's settings are not changed, and you can show it again at any time.`
            : `${org.name}'s public page loads for visitors again.`
        }
        confirmLabel={org.isActive ? "Hide" : "Show"}
        pendingLabel="Saving..."
        isPending={setActiveMutation.isPending}
        onConfirm={() =>
          setActiveMutation.mutate(
            { organizationId: org.id, isActive: !org.isActive },
            { onSuccess: () => setConfirmOpen(false) }
          )
        }
      />
    </>
  );
};

export default AdminOrganizationDetailPage;