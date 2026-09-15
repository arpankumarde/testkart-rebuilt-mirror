import React, { useState, useMemo } from "react";
import { Helmet } from "react-helmet";
import { Search, Copy, Check, Info } from "lucide-react";
import { apiDocsData, getApiCategories, ApiEndpoint } from "../helpers/apiDocsData";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "../components/Accordion";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { ConsoleListEmpty } from "../components/ConsoleListEmpty";
import { useDebounce } from "../helpers/useDebounce";
import styles from "./admin.api-docs.module.css";

const EndpointCard: React.FC<{ endpoint: ApiEndpoint }> = ({ endpoint }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(`https://testkart.in${endpoint.route}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const hasParams = endpoint.queryParams?.length || endpoint.bodyParams?.length;
  const hasResponse = endpoint.responseFields?.length > 0;
  const hasNotes = endpoint.notes && endpoint.notes.length > 0;

  return (
    <div className={styles.endpointCard}>
      <div className={styles.endpointHeader}>
        <div className={styles.routeInfo}>
          <div className={styles.routeTopLine}>
            <span className={`${styles.methodBadge} ${styles[endpoint.method]}`}>
              {endpoint.method}
            </span>
            <span className={styles.routePath}>{endpoint.route}</span>
            <button
              onClick={handleCopy}
              className={styles.copyBtn}
              aria-label={copied ? "URL copied" : `Copy the URL for ${endpoint.route}`}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
            <span className={`${styles.authBadge} ${styles[endpoint.auth]}`}>
              Auth: {endpoint.auth}
            </span>
          </div>
          <p className={styles.description}>{endpoint.description}</p>
        </div>
      </div>

      {(hasParams || hasResponse || hasNotes) && (
        <Accordion type="multiple">
          <AccordionItem value="details" className={styles.accordionItemOverrides}>
            <AccordionTrigger className={styles.customAccordionTrigger}>
              Parameters and response
            </AccordionTrigger>
            <AccordionContent>
              <div className={styles.endpointDetails}>
                {endpoint.queryParams && endpoint.queryParams.length > 0 && (
                  <>
                    <h4 className={styles.sectionTitle}>Query parameters</h4>
                    <table className={styles.dataTable}>
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Type</th>
                          <th>Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {endpoint.queryParams.map((p) => (
                          <tr key={p.name}>
                            <td>
                              {p.name}
                              {p.required && <span className={styles.requiredBadge}>*</span>}
                            </td>
                            <td><span className={styles.typeLabel}>{p.type}</span></td>
                            <td>{p.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}

                {endpoint.bodyParams && endpoint.bodyParams.length > 0 && (
                  <>
                    <h4 className={styles.sectionTitle}>Body parameters</h4>
                    <table className={styles.dataTable}>
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Type</th>
                          <th>Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {endpoint.bodyParams.map((p) => (
                          <tr key={p.name}>
                            <td>
                              {p.name}
                              {p.required && <span className={styles.requiredBadge}>*</span>}
                            </td>
                            <td><span className={styles.typeLabel}>{p.type}</span></td>
                            <td>{p.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}

                {hasResponse && (
                  <>
                    <h4 className={styles.sectionTitle}>Response fields</h4>
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
                            <td>{f.name}</td>
                            <td><span className={styles.typeLabel}>{f.type}</span></td>
                            <td>{f.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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

export default function AdminApiDocs() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);

  const categories = useMemo(() => getApiCategories(), []);

  const filteredEndpoints = useMemo(() => {
    return apiDocsData.filter((endpoint) => {
      const matchesCategory = activeCategory === "All" || endpoint.category === activeCategory;
      const searchLower = debouncedSearch.toLowerCase();
      const matchesSearch =
        debouncedSearch === "" ||
        endpoint.route.toLowerCase().includes(searchLower) ||
        endpoint.description.toLowerCase().includes(searchLower);
      
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, debouncedSearch]);

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
            <li><strong>Base URL:</strong> <code>https://testkart.in</code></li>
            <li><strong>Serialization:</strong> POST bodies and all responses use <strong>superjson</strong>, so Dates and Sets survive the round trip.</li>
            <li>
              <strong>Authentication:</strong> two ways in.
              <ul>
                <li><strong>Cookie:</strong> the HTTP-only JWT in <code>floot_built_app_session</code>, sent by browsers automatically.</li>
                <li><strong>Bearer token:</strong> send <code>Authorization: Bearer &lt;token&gt;</code>. Best for the mobile app and external clients. Get a token from <code>POST /_api/auth/api-token</code> while signed in.</li>
              </ul>
            </li>
            <li><strong>Session length:</strong> sessions and API tokens last 30 days.</li>
            <li><strong>Content type:</strong> every POST must set <code>Content-Type: application/json</code>.</li>
          </ul>
        </div>

        <div className={styles.layout}>
          <aside className={styles.sidebar}>
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`${styles.categoryBtn} ${activeCategory === category ? styles.active : ""}`}
              >
                {category}
              </button>
            ))}
          </aside>

          <main className={styles.mainContent}>
            <div className={styles.searchBar}>
              <Search size={18} className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Search by route or description"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.searchInput}
              />
            </div>

            {filteredEndpoints.length > 0 ? (
              filteredEndpoints.map((endpoint, idx) => (
                <EndpointCard key={`${endpoint.route}-${idx}`} endpoint={endpoint} />
              ))
            ) : (
              <ConsoleListEmpty
                icon={<Search size={24} />}
                title="No endpoints match that search"
                description="Try part of a route, like /student, or a word from the description."
              />
            )}
          </main>
        </div>
      </div>
    </>
  );
}