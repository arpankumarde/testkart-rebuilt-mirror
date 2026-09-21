import React from "react";
import { Checkbox } from "./Checkbox";
import { Button } from "./Button";
import {
  ADMIN_MODULE_GROUPS,
  ADMIN_MODULE_KEYS,
  ADMIN_MODULES,
  normalizeAdminPermissions,
  type AdminModule,
} from "../helpers/adminPermissions";
import styles from "./AdminAccessChecklist.module.css";

type Props = {
  value: readonly AdminModule[];
  onChange: (next: AdminModule[]) => void;
  disabled?: boolean;
};

/** One checkbox per admin module, grouped the way the sidebar is. */
export const AdminAccessChecklist = ({ value, onChange, disabled }: Props) => {
  const selected = new Set<AdminModule>(value);
  const set = (keys: readonly AdminModule[], on: boolean) => {
    const next = new Set(selected);
    keys.forEach((key) => (on ? next.add(key) : next.delete(key)));
    onChange(normalizeAdminPermissions([...next]));
  };

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <span className={styles.summary} aria-live="polite">
          {selected.size} of {ADMIN_MODULE_KEYS.length} sections
        </span>
        <div className={styles.toolbarActions}>
          <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => set(ADMIN_MODULE_KEYS, true)}>
            Select all
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => set(ADMIN_MODULE_KEYS, false)}>
            Clear
          </Button>
        </div>
      </div>

      {ADMIN_MODULE_GROUPS.map((group) => {
        const modules = ADMIN_MODULES.filter((m) => m.group === group);
        const keys = modules.map((m) => m.key);
        const count = keys.filter((key) => selected.has(key)).length;
        const all = count === keys.length;
        return (
          <fieldset key={group} className={styles.group} disabled={disabled}>
            <legend className={styles.legend}>
              <label className={styles.groupToggle}>
                <Checkbox
                  checked={all}
                  ref={(el) => {
                    if (el) el.indeterminate = count > 0 && !all;
                  }}
                  onChange={(e) => set(keys, e.target.checked)}
                />
                <span className={styles.groupName}>{group}</span>
              </label>
              <span className={styles.groupCount}>
                {count}/{keys.length}
              </span>
            </legend>
            <div className={styles.grid}>
              {modules.map((m) => (
                <label key={m.key} className={styles.option}>
                  <Checkbox checked={selected.has(m.key)} onChange={(e) => set([m.key], e.target.checked)} />
                  <span className={styles.optionText}>
                    <span className={styles.optionLabel}>{m.label}</span>
                    <span className={styles.optionHint}>{m.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
};