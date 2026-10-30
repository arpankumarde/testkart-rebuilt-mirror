import React from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "./Button";
import styles from "./GecListEditor.module.css";

interface GecListEditorProps<T> {
  items: T[];
  onChange: (items: T[]) => void;
  /** The fields of one item. `update` merges a patch into it. */
  renderItem: (item: T, update: (patch: Partial<T>) => void, index: number) => React.ReactNode;
  itemTitle: (item: T, index: number) => string;
  newItem: () => T;
  addLabel: string;
  max?: number;
  min?: number;
  /** Extra controls on an item's header, such as a published switch. */
  headerExtra?: (item: T, update: (patch: Partial<T>) => void) => React.ReactNode;
}

/** An ordered list of cards with move up, move down, delete and add. Used for every repeating block of the page. */
export function GecListEditor<T>({ items, onChange, renderItem, itemTitle, newItem, addLabel, max = 50, min = 0, headerExtra }: GecListEditorProps<T>) {
  const update = (index: number) => (patch: Partial<T>) => onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  const move = (index: number, by: number) => {
    const next = [...items];
    const [item] = next.splice(index, 1);
    next.splice(index + by, 0, item);
    onChange(next);
  };

  return (
    <div className={styles.list}>
      {items.map((item, index) => (
        <div key={index} className={styles.item}>
          <div className={styles.head}>
            <span className={styles.index}>{index + 1}</span>
            <span className={styles.title}>{itemTitle(item, index)}</span>
            {headerExtra?.(item, update(index))}
            <div className={styles.tools}>
              <Button variant="ghost" size="icon-sm" aria-label="Move up" disabled={index === 0} onClick={() => move(index, -1)}>
                <ArrowUp size={15} />
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label="Move down" disabled={index === items.length - 1} onClick={() => move(index, 1)}>
                <ArrowDown size={15} />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                className={styles.danger}
                aria-label={`Remove ${itemTitle(item, index)}`}
                disabled={items.length <= min}
                onClick={() => onChange(items.filter((_, i) => i !== index))}
              >
                <Trash2 size={15} />
              </Button>
            </div>
          </div>
          <div className={styles.body}>{renderItem(item, update(index), index)}</div>
        </div>
      ))}
      <Button variant="outline" size="sm" className={styles.add} disabled={items.length >= max} onClick={() => onChange([...items, newItem()])}>
        <Plus size={15} /> {addLabel}
      </Button>
    </div>
  );
}