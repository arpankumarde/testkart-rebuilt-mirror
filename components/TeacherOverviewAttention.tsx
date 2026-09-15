import React, { useEffect, useId, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, ChevronDown } from "lucide-react";
import type { TeacherAttentionCounts } from "../endpoints/teacher/dashboard/overview_GET.schema";
import { teacherAttention, TeacherAttentionTile } from "../helpers/teacherAttention";
import { adminFormat } from "../helpers/adminFormat";
import styles from "./TeacherOverviewAttention.module.css";

const COLLAPSED_KEY = "teacher_attention_collapsed";

type Props = {
  attention: TeacherAttentionCounts | undefined;
  className?: string;
};

const Tile = ({ tile }: { tile: TeacherAttentionTile }) => {
  const Icon = tile.icon;

  return (
    <li className={styles.tile}>
      <Link to={tile.href} className={styles.tileLink}>
        <span className={styles.tileIcon}>
          <Icon size={15} aria-hidden="true" />
        </span>
        <span className={styles.tileBody}>
          <span className={styles.tileHeadline}>
            <span className={styles.tileCount}>{adminFormat.count(tile.count)}</span>
            <span className={styles.tileTitle}>{tile.title}</span>
          </span>
          <span className={styles.tileDetail}>{tile.detail}</span>
        </span>
        <ChevronRight size={16} className={styles.tileChevron} aria-hidden="true" />
      </Link>
    </li>
  );
};

/**
 * Renders nothing at all unless there is something to act on — no all-clear
 * panel, and no skeleton either, since a coral block that appears while
 * loading and then disappears is worse than one that simply shows up when it
 * has something to say.
 */
export const TeacherOverviewAttention = ({ attention, className }: Props) => {
  const bodyId = useId();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSED_KEY) === "1");
    } catch {
      // Storage unavailable: the band simply starts expanded.
    }
  }, []);

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        // Preference resets next visit.
      }
      return next;
    });
  };

  const tiles = attention ? teacherAttention.tiles(attention) : [];
  if (tiles.length === 0) return null;

  const total = tiles.reduce((sum, tile) => sum + tile.count, 0);
  const summary = `${adminFormat.count(total)} across ${tiles.length} ${tiles.length === 1 ? "queue" : "queues"}`;

  return (
    <section className={`${styles.band} ${className ?? ""}`.trim()} aria-label="Needs attention">
      <div className={styles.head}>
        <span className={styles.chip}>Needs attention</span>
        <span className={styles.summary}>{summary}</span>
        <button
          type="button"
          className={styles.toggle}
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-controls={bodyId}
        >
          {collapsed ? "Show" : "Hide"}
          <ChevronDown
            size={16}
            className={`${styles.toggleIcon} ${collapsed ? styles.toggleIconCollapsed : ""}`}
            aria-hidden="true"
          />
        </button>
      </div>

      <div
        id={bodyId}
        className={`${styles.body} ${collapsed ? styles.bodyCollapsed : ""}`}
        aria-hidden={collapsed}
        inert={collapsed}
      >
        <div className={styles.bodyInner}>
          <ul className={styles.tiles}>
            {tiles.map((tile) => (
              <Tile key={tile.key} tile={tile} />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};
