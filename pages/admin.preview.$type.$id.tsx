import React from "react";
import { Helmet } from "react-helmet";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, ExternalLink, Pencil } from "lucide-react";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { ConsoleListEmpty } from "../components/ConsoleListEmpty";
import { AdminContentStatusActions } from "../components/AdminContentStatusActions";
import { AdminPreviewContent, formatPreviewDate, previewStatusVariant } from "../components/AdminPreviewContent";
import {
  PREVIEW_STATUS_LABELS,
  PREVIEW_TYPE_LABELS,
  useAdminContentPreview,
} from "../helpers/useAdminContentPreview";
import {
  OutputType,
  PREVIEW_CONTENT_TYPES,
  PreviewContentType,
} from "../endpoints/admin/content-preview/details_GET.schema";
import styles from "./admin.preview.$type.$id.module.css";
import { useAdminAuth } from "../helpers/useAdminAuth";
import { hasAdminModule } from "../helpers/adminPermissions";
import { ADMIN_EDIT_MODULES, adminEditPath, isAdminEditType } from "../helpers/adminContentEdit";

const publicUrl = (data: OutputType): string | null => {
  if (data.status !== "published") return null;
  switch (data.type) {
    case "course":
      return data.slug ? `/course/${data.slug}` : null;
    case "digital_product":
      return data.slug ? `/study-notes/${data.slug}` : null;
    case "course_bundle":
      return data.slug ? `/bundles/${data.slug}` : null;
    case "mock_test":
      return data.slug ? `/mock-test/${data.slug}` : null;
    case "live_test":
      return `/mock-test/live/${data.id}`;
  }
};

const LoadingState = () => (
  <div className={styles.page}>
    <Skeleton style={{ height: "2.25rem", width: "60%" }} />
    <Skeleton style={{ height: "8rem", width: "100%" }} />
    <Skeleton style={{ height: "14rem", width: "100%" }} />
  </div>
);

const LIST_PATHS: Record<PreviewContentType, { href: string; label: string }> = {
  mock_test: { href: "/admin/test-series", label: "test series" },
  course: { href: "/admin/courses", label: "courses" },
  digital_product: { href: "/admin/notes", label: "study notes" },
  course_bundle: { href: "/admin/bundles", label: "bundles" },
  live_test: { href: "/admin/live-tests", label: "live tests" },
};

/* Previews usually open in a new tab with no history, so the arrow falls back to the list they came from. */
const BackLink = ({ type }: { type: PreviewContentType | null }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const target =
    searchParams.get("from") === "reviews" || !type
      ? { href: "/admin/content-reviews", label: "content reviews" }
      : LIST_PATHS[type];
  const hasHistory = location.key !== "default";
  return (
    <Link
      to={target.href}
      className={styles.backLink}
      onClick={(e) => {
        if (!hasHistory) return;
        e.preventDefault();
        navigate(-1);
      }}
    >
      <ArrowLeft size={16} aria-hidden="true" />
      {hasHistory ? "Back" : `Back to ${target.label}`}
    </Link>
  );
};

export default function AdminContentPreviewPage() {
  const params = useParams<{ type: string; id: string }>();
  const type = (PREVIEW_CONTENT_TYPES as readonly string[]).includes(params.type ?? "")
    ? (params.type as PreviewContentType)
    : null;
  const id = Number(params.id);
  const validId = Number.isInteger(id) && id > 0 ? id : null;
  const { data, isFetching, isError, error, refetch } = useAdminContentPreview(type, validId);
  const { authState } = useAdminAuth();
  const permissions = authState.type === "authenticated" ? authState.admin.permissions ?? [] : [];

  const helmet = (
    <Helmet>
      <title>{data ? `Preview: ${data.title}` : "Content preview"} - Testkart Admin</title>
      <meta name="robots" content="noindex,nofollow" />
    </Helmet>
  );

  if (!type || !validId) {
    return (
      <div className={styles.page}>
        {helmet}
        <BackLink type={type} />
        <ConsoleListEmpty
          tone="error"
          icon={<AlertCircle size={24} />}
          title="This preview link is not valid"
          description="Open the item from its admin list to preview it."
        />
      </div>
    );
  }

  if (isFetching && (!data || data.id !== validId || data.type !== type)) return <LoadingState />;

  if (isError || !data) {
    return (
      <div className={styles.page}>
        {helmet}
        <BackLink type={type} />
        <ConsoleListEmpty
          tone="error"
          icon={<AlertCircle size={24} />}
          title="Could not load this item"
          description={error instanceof Error ? error.message : "The request did not come back. Try again."}
        >
          <Button variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
        </ConsoleListEmpty>
      </div>
    );
  }

  const liveUrl = publicUrl(data);
  const editUrl =
    isAdminEditType(data.type) && data.status !== "trashed" && hasAdminModule(permissions, [ADMIN_EDIT_MODULES[data.type]])
      ? adminEditPath(data.type, data.id)
      : null;

  return (
    <div className={styles.page}>
      {helmet}
      <BackLink type={type} />
      <ConsolePageHeader title={data.title}>
        {editUrl && (
          <Button variant="outline" asChild>
            <Link to={`${editUrl}?from=preview`}>
              <Pencil size={16} />
              Edit
            </Link>
          </Button>
        )}
        <AdminContentStatusActions data={data} />
        {liveUrl && (
          <Button variant="outline" asChild>
            <a href={liveUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={16} />
              View public page
            </a>
          </Button>
        )}
      </ConsolePageHeader>

      <div className={styles.badgeRow}>
        <Badge variant="outline">{PREVIEW_TYPE_LABELS[data.type]}</Badge>
        <Badge variant={previewStatusVariant(data.status)}>{PREVIEW_STATUS_LABELS[data.status]}</Badge>
        {data.inReview && (
          <Link
            to={`/admin/content-reviews?contentType=${data.type}${data.awaitingSenior ? "&status=senior_review" : ""}`}
            className={styles.reviewLink}
          >
            {data.awaitingSenior ? "Waiting for senior approval" : "Waiting for review"}
          </Link>
        )}
      </div>

      {data.status !== "published" && (
        <p className={styles.notice}>
          Admin preview. Students cannot see this {PREVIEW_TYPE_LABELS[data.type].toLowerCase()} while it is{" "}
          {PREVIEW_STATUS_LABELS[data.status].toLowerCase()}.
        </p>
      )}

      {data.lastReview && (
        <p className={`${styles.notice} ${data.lastReview.status === "rejected" ? styles.noticeRejected : ""}`}>
          <strong>
            {data.lastReview.status === "rejected" ? "Rejected" : "Approved"} {formatPreviewDate(data.lastReview.reviewedAt)}
            {data.lastReview.notes ? ": " : ""}
          </strong>
          {data.lastReview.notes}
        </p>
      )}

      <div className={styles.layout}>
        <div className={styles.main}>
          <AdminPreviewContent data={data} />
        </div>

        <aside className={styles.aside}>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Details</h2>
            <dl className={styles.facts}>
              <div className={styles.fact}>
                <dt>Teacher</dt>
                <dd>
                  {data.teacher.name}
                  {data.teacher.email && <span className={styles.subValue}>{data.teacher.email}</span>}
                </dd>
              </div>
              {data.facts.map((f) => (
                <div key={f.label} className={styles.fact}>
                  <dt>{f.label}</dt>
                  <dd>{f.value}</dd>
                </div>
              ))}
              <div className={styles.fact}>
                <dt>Created</dt>
                <dd>{formatPreviewDate(data.createdAt)}</dd>
              </div>
              <div className={styles.fact}>
                <dt>Last updated</dt>
                <dd>{formatPreviewDate(data.updatedAt)}</dd>
              </div>
              {data.publishedAt && (
                <div className={styles.fact}>
                  <dt>First published</dt>
                  <dd>{formatPreviewDate(data.publishedAt)}</dd>
                </div>
              )}
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
