import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import styles from "./HomepageSearchHero.module.css";

export function HomepageSearchHero() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <section className={styles.hero}>
      <div className={styles.content}>
        <h1 className={styles.title}>Find mock tests, courses & study notes</h1>
        <p className={styles.subtitle}>All made by real teachers and coaching institutes</p>
        <form className={styles.searchForm} onSubmit={handleSearch}>
          <div className={styles.inputWrapper}>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search mock tests, teachers, courses, exams..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button type="submit" className={styles.searchIconBtn} aria-label="Search">
              <Search size={24} />
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}