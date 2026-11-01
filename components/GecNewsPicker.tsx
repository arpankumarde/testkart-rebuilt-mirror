import React, { useState } from "react";
import { AlertTriangle, ExternalLink, Newspaper, Search, X } from "lucide-react";
import { Button } from "./Button";
import { Input } from "./Input";
import { Popover, PopoverContent, PopoverTrigger } from "./Popover";
import { gecNewsPath, type GecNewsLink } from "../helpers/gecModel";
import { useAdminGecNewsPosts } from "../helpers/useAdminGovtExamsCalendar";
import styles from "./GecNewsPicker.module.css";

interface GecNewsPickerProps {
  id?: string;
  value: GecNewsLink | null;
  onChange: (post: GecNewsLink | null) => void;
  /** The record's Testkart exam, used to list matching articles first. Never links on its own. */
  suggestForExamId: number | null;
}

/**
 * Searchable picker for the Exam News article an exam name links to. Lists published articles only;
 * the selected one shows its title and slug and can be changed or removed.
 */
export const GecNewsPicker: React.FC<GecNewsPickerProps> = ({ id, value, onChange, suggestForExamId }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { data, isFetching } = useAdminGecNewsPosts(query, suggestForExamId, open);
  const posts = data?.posts ?? [];

  return (
    <div className={styles.picker}>
      {value && (
        <div className={`${styles.chosen} ${value.status !== "published" ? styles.chosenWarn : ""}`}>
          <Newspaper size={16} aria-hidden="true" />
          <div className={styles.chosenText}>
            <span className={styles.chosenTitle}>{value.title}</span>
            <span className={styles.slug}>{gecNewsPath(value.slug)}</span>
            {value.status !== "published" && (
              <span className={styles.warn}>
                <AlertTriangle size={13} aria-hidden="true" /> This article is {value.status}. The exam name shows as plain text until you pick a published one.
              </span>
            )}
          </div>
          {value.status === "published" && (
            <Button asChild variant="ghost" size="icon-sm" aria-label="Open the article">
              <a href={gecNewsPath(value.slug)} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={15} />
              </a>
            </Button>
          )}
          <Button variant="ghost" size="icon-sm" aria-label="Remove the linked article" onClick={() => onChange(null)}>
            <X size={15} />
          </Button>
        </div>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button id={id} variant="outline" size="sm" className={styles.trigger}>
            <Search size={15} /> {value ? "Change article" : "Choose an Exam News article"}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className={styles.panel} onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className={styles.searchWrap}>
            <Search size={15} className={styles.icon} aria-hidden="true" />
            <Input
              autoFocus
              value={query}
              placeholder="Search published news by title or slug"
              className={styles.input}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search Exam News"
            />
          </div>
          {!query.trim() && suggestForExamId === null ? (
            <p className={styles.empty}>Type at least 2 letters. Link a Testkart exam above to see its articles here first.</p>
          ) : posts.length === 0 ? (
            <p className={styles.empty}>{isFetching ? "Searching..." : "No published article matches"}</p>
          ) : (
            <ul className={styles.list} role="listbox" aria-label="Published Exam News articles">
              {posts.map((post) => (
                <li key={post.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={value?.id === post.id}
                    className={`${styles.option} ${value?.id === post.id ? styles.optionOn : ""}`}
                    onClick={() => {
                      onChange({ id: post.id, slug: post.slug, title: post.title, status: "published" });
                      setQuery("");
                      setOpen(false);
                    }}
                  >
                    <span className={styles.optionTitle}>
                      {post.title}
                      {post.suggested && <span className={styles.badge}>Same exam</span>}
                    </span>
                    <span className={styles.slug}>
                      {gecNewsPath(post.slug)}
                      {post.publishedAt ? ` - ${new Date(post.publishedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
};