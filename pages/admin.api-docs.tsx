import React, { useState, useMemo } from "react";
import { Helmet } from "react-helmet";
import { Search, Copy, Check, Info, TriangleAlert } from "lucide-react";
import {
  apiDocsData,
  getApiCategories,
  ApiEndpoint,
  API_AUTH_LABELS,
  isMobileOnly,
  isWebOnly,
} from "../helpers/apiDocsData";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "../components/Accordion";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { ConsoleListEmpty } from "../components/ConsoleListEmpty";
import { useDebouncedInput } from "../helpers/useDebouncedInput";
import styles from "./admin.api-docs.module.css";

type StatusFilter = "all" | "mobile" | "mobileOnly" | "webOnly" | "deprecated";

const STATUS_FILTERS: { key: StatusFilter; label: string; matches: (endpoint: ApiEndpoint) => boolean }[] = [
  { key: "all", label: "All", matches: () => true },
  { key: "mobile", label: "Used by the mobile app", matches: (e) => e.usedBy.includes("mobile") },
  { key: "mobileOnly", label: "Mobile only", matches: isMobileOnly },
  { key: "webOnly", label: "Web only", matches: isWebOnly },
  { key: "deprecated", label: "Deprecated", matches: (e) => Boolean(e.deprecated) },
];

const ParamTable: React.FC<{ title: string; params: NonNullable<ApiEndpoint["queryParams"]> }> = ({
  title,
  params,
}) => (
  <>
    <h4 className={styles.sectionTitle}>{title}</h4>
    <div className={styles.tableScroll}>
      <table className={styles.dataTable}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {params.map((p) => (
            <tr key={p.name}>
              <td className={styles.nameCell}>
                {p.name}
                {p.required && <span className={styles.requiredBadge}>required</span>}
              </td>
              <td><span className={styles.typeLabel}>{p.type}</span></td>
              <td>{p.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </>
);

const UsageBadges: React.FC<{ endpoint: ApiEndpoint }> = ({ endpoint }) => {
  if (isMobileOnly(endpoint)) {
    return <span className={`${styles.statusBadge} ${styles.mobileOnly}`}>Mobile only</span>;
  }
  if (isWebOnly(endpoint)) {
    return <span className={styles.statusBadge}>Web only</span>;
  }
  if (endpoint.usedBy.length === 0) {
    return <span className={styles.statusBadge}>No web or app caller</span>;
  }
  return (
    <>
      <span className={styles.statusBadge}>Web</span>
      <span className={`${styles.statusBadge} ${styles.mobileApp}`}>Mobile app</span>
    </>
  );
};

const EndpointCard: React.FC<{ endpoint: ApiEndpoint }> = ({ endpoint }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(`https://testkart.in${endpoint.route}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const hasQuery = Boolean(endpoint.queryParams?.length);
  const hasBody = Boolean(endpoint.bodyParams?.length);
  const hasResponse = endpoint.responseFields.length > 0;
  const hasNotes = Boolean(endpoint.notes?.length);

  return (
    <div className={`${styles.endpointCard} ${endpoint.deprecated ? styles.deprecatedCard : ""}`}>
      <div className={styles.endpointHeader}>
        <div className={styles.routeTopLine}>
          <span className={`${styles.methodBadge} ${styles[endpoint.method]}`}>{endpoint.method}</span>
          <span className={styles.routePath}>{endpoint.route}</span>
          <button
            onClick={handleCopy}
            className={styles.copyBtn}
            aria-label={copied ? "URL copied" : `Copy the URL for ${endpoint.route}`}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
        </div>
        <p className={styles.description}>{endpoint.description}</p>
        <div className={styles.badgeRow}>
          <span className={`${styles.authBadge} ${styles[`auth_${endpoint.auth}`]}`}>
            Auth: {API_AUTH_LABELS[endpoint.auth]}
          </span>
          <UsageBadges endpoint={endpoint} />
          {endpoint.deprecated && (
            <span className={`${styles.statusBadge} ${styles.deprecated}`}>Deprecated</span>
          )}
        </div>
        {endpoint.deprecated && (
          <p className={styles.deprecatedNote}>
            <TriangleAlert size={16} aria-hidden />
            <span>{endpoint.deprecated}</span>
          </p>
        )}
      </div>

      {(hasQuery || hasBody || hasResponse || hasNotes) && (
        <Accordion type="multiple">
          <AccordionItem value="details" className={styles.detailsItem}>
            <AccordionTrigger className={styles.customAccordionTrigger}>
              Parameters and response
            </AccordionTrigger>
            <AccordionContent>
              <div className={styles.endpointDetails}>
                {hasQuery && <ParamTable title="Query parameters" params={endpoint.queryParams!} />}
                {hasBody && <ParamTable title="Body parameters" params={endpoint.bodyParams!} />}

                {hasResponse && (
                  <>
                    <h4 className={styles.sectionTitle}>Response fields</h4>
                    <div className={styles.tableScroll}>
                      <table className={styles.dataTable}>
                        <thead>
                          <tr>
                            <th>Field</th>
                            <th>Type</th>
                            <th>Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          {endpoint.responseFields.map((f) => (
                            <tr key={f.name}>
                              <td className={styles.nameCell}>{f.name}</td>
                              <td><span className={styles.typeLabel}>{f.type}</span></td>
                              <td>{f.description}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {hasNotes && (
                  <>
                    <h4 className={styles.sectionTitle}>Notes</h4>
                    <ul className={styles.notesList}>
                      {endpoint.notes?.map((note, i) => (
                        <li key={i}>{note}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </div>
  );
};

const matchesSearch = (endpoint: ApiEndpoint, query: string) => {
  if (!query) return true;
  const haystack = [
    endpoint.route,
    endpoint.description,
    endpoint.deprecated ?? "",
    ...(endpoint.notes ?? []),
    ...(endpoint.queryParams ?? []).map((p) => p.name),
    ...(endpoint.bodyParams ?? []).map((p) => p.name),
  ]
    .join("\n")
    .toLowerCase();
  return haystack.includes(query);
};

export default function AdminApiDocs() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const searchInput = useDebouncedInput(searchQuery, setSearchQuery);

  const categories = useMemo(() => getApiCategories(), []);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>([["All", apiDocsData.length]]);
    for (const endpoint of apiDocsData) {
      counts.set(endpoint.category, (counts.get(endpoint.category) ?? 0) + 1);
    }
    return counts;
  }, []);

  const inCategory = useMemo(
    () => apiDocsData.filter((e) => activeCategory === "All" || e.category === activeCategory),
    [activeCategory]
  );

  const statusCounts = useMemo(
    () => new Map(STATUS_FILTERS.map((f) => [f.key, inCategory.filter(f.matches).length])),
    [inCategory]
  );

  const filteredEndpoints = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const status = STATUS_FILTERS.find((f) => f.key === statusFilter)!;
    return inCategory.filter((e) => status.matches(e) && matchesSearch(e, query));
  }, [inCategory, statusFilter, searchQuery]);

  return (
    <>
      <Helmet>
        <title>API docs - Testkart Admin</title>
      </Helmet>

      <div className={styles.page}>
        <ConsolePageHeader title="API docs" />

        <div className={styles.infoBox}>
          <h3><Info size={18} /> How these endpoints work</h3>
          <ul>
            <li>
              <strong>Base URL:</strong> <code>https://testkart.in</code>. This page covers the public, student and
              shared endpoints and the MCP connectors. Teacher console (<code>/_api/teacher/*</code>) and admin panel
              (<code>/_api/admin/*</code>) endpoints serve those screens only and can change without notice.
            </li>
            <li>
              <strong>Request format:</strong> GET inputs go in the query string. POST bodies are superjson, sent as{" "}
              <code>{'{ "json": { ... } }'}</code> with <code>Content-Type: application/json</code>. Responses are
              superjson too, so read the <code>json</code> field. The MCP and OAuth endpoints use plain JSON or form
              fields instead, as their cards say.
            </li>
            <li>
              <strong>Authentication:</strong> two ways in. When both are sent, the bearer token wins.
              <ul>
                <li><strong>Cookie:</strong> the HTTP-only <code>floot_built_app_session</code> JWT the web app gets at sign-in.</li>
                <li>
                  <strong>Bearer token:</strong> <code>Authorization: Bearer &lt;token&gt;</code>. The mobile app gets one
                  from its sign-in endpoints. A script can get one from <code>POST /_api/auth/api-token</code> with a
                  signed-in session, sent from a server rather than a browser page. Browser requests and impersonation
                  sessions are refused.
                </li>
              </ul>
            </li>
            <li>
              <strong>Lifetimes:</strong> sign-in sessions last 90 days. API tokens last 30 days and stop working as soon
              as the session they came from signs out.
            </li>
            <li>
              <strong>Errors:</strong> <code>{"{ error }"}</code> with a 4xx or 5xx status. Many endpoints answer a missing
              or expired session with a 500 whose error says "Not authenticated", so treat that message as signed out.
            </li>
            <li>
              <strong>Badges:</strong> "Mobile app" and "Mobile only" mean the shipped mobile app calls the endpoint, so a
              breaking change has to wait for an app release that stops using it. "Deprecated" endpoints still work, and
              the card says what replaces them.
            </li>
          </ul>
        </div>

        <div className={styles.layout}>
          <aside className={styles.sidebar} aria-label="Categories">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`${styles.categoryBtn} ${activeCategory === category ? styles.active : ""}`}
                aria-pressed={activeCategory === category}
              >
                <span>{category}</span>
                <span className={styles.categoryCount}>{categoryCounts.get(category) ?? 0}</span>
              </button>
            ))}
          </aside>

          <div className={styles.mainContent}>
            <div className={styles.searchBar}>
              <Search size={18} className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Search routes, descriptions, parameters and notes"
                value={searchInput.value}
                onChange={(e) => searchInput.onChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") searchInput.flush();
                }}
                className={styles.searchInput}
                aria-label="Search endpoints"
              />
            </div>

            <div className={styles.statusFilters} role="group" aria-label="Filter by status">
              {STATUS_FILTERS.map((filter) => (
                <button
                  key={filter.key}
                  onClick={() => setStatusFilter(filter.key)}
                  className={`${styles.statusFilterBtn} ${statusFilter === filter.key ? styles.statusFilterActive : ""}`}
                  aria-pressed={statusFilter === filter.key}
                >
                  {filter.label}
                  <span className={styles.statusFilterCount}>{statusCounts.get(filter.key) ?? 0}</span>
                </button>
              ))}
            </div>

            <p className={styles.resultCount} aria-live="polite">
              Showing {filteredEndpoints.length} of {apiDocsData.length} endpoints
            </p>

            {filteredEndpoints.length > 0 ? (
              filteredEndpoints.map((endpoint) => (
                <EndpointCard key={`${endpoint.method} ${endpoint.route}`} endpoint={endpoint} />
              ))
            ) : (
              <ConsoleListEmpty
                icon={<Search size={24} />}
                title="No endpoints match these filters"
                description="Try part of a route, like /student, or switch the status filter back to All."
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
