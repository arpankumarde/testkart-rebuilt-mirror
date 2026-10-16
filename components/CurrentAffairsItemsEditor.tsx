import React, { useEffect, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlertCircle,
  AlignLeft,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  Copy,
  GripVertical,
  ImagePlus,
  Plus,
  Tags,
  Trash2,
} from "lucide-react";
import { Button } from "./Button";
import { Input } from "./Input";
import { Textarea } from "./Textarea";
import { RichTextEditor } from "./RichTextEditor";
import { ImageUploader } from "./ImageUploader";
import { FormControl, FormItem, FormLabel, FormMessage } from "./Form";
import { CurrentAffairsTagPicker } from "./CurrentAffairsTagPicker";
import { CurrentAffairsSourcesEditor } from "./CurrentAffairsSourcesEditor";
import { ConsoleConfirmDialog } from "./ConsoleConfirmDialog";
import { currentAffairsMeta } from "../helpers/currentAffairsMeta";
import type { CurrentAffairsItemInput, CurrentAffairsTagRef } from "../endpoints/admin/current-affairs/save_POST.schema";
import type { CurrentAffairsTagOption } from "../endpoints/admin/current-affairs/tags_GET.schema";
import styles from "./CurrentAffairsItemsEditor.module.css";

type FormErrorTree = { [key: string]: string | FormErrorTree };

interface CurrentAffairsItemsEditorProps {
  items: CurrentAffairsItemInput[];
  onChange: (items: CurrentAffairsItemInput[]) => void;
  tagOptions: CurrentAffairsTagOption[];
  /* The post's own tags, offered as a one-click fill for each item. */
  postTags: CurrentAffairsTagRef[];
  /* The form's error tree; used to count and reveal problems per item. */
  errors: FormErrorTree;
  /* "single" edits items[0] as the post's story, without list chrome. */
  mode?: "list" | "single";
}

const newKey = () => `new-${Math.random().toString(36).slice(2, 10)}`;

export const emptyCurrentAffairsItem = (): CurrentAffairsItemInput => ({
  key: newKey(),
  headline: "",
  whyInNews: "",
  keyPoints: "",
  background: "",
  imageUrl: "",
  imageFileId: "",
  imageAlt: "",
  imageCredit: "",
  tags: [],
  sources: [{ name: "", url: "" }],
});

const countLeaves = (node: string | FormErrorTree | undefined): number =>
  !node ? 0 : typeof node === "string" ? 1 : Object.values(node).reduce<number>((sum, child) => sum + countLeaves(child), 0);

const hasContent = (item: CurrentAffairsItemInput) =>
  !!(item.headline.trim() || item.whyInNews.trim() || currentAffairsMeta.stripHtml(item.keyPoints) || currentAffairsMeta.stripHtml(item.background));

const ItemFields: React.FC<{
  index: number;
  item: CurrentAffairsItemInput;
  update: (patch: Partial<CurrentAffairsItemInput>) => void;
  tagOptions: CurrentAffairsTagOption[];
  postTags: CurrentAffairsTagRef[];
}> = ({ index, item, update, tagOptions, postTags }) => {
  const base = `items.${index}`;
  const [showImage, setShowImage] = useState(!!item.imageUrl);
  // Why in news and background are optional extras; they open on their own when an older item has them.
  const [showContext, setShowContext] = useState(!!(item.whyInNews.trim() || currentAffairsMeta.stripHtml(item.background)));
  const canCopyTags = postTags.length > 0 && postTags.some((t) => !item.tags.some((own) => own.kind === t.kind && own.name === t.name));
  const tagKinds = (["topic", "exam", "syllabus"] as const).filter(
    (kind) => kind === "topic" || item.tags.some((t) => t.kind === kind)
  );

  return (
    <div className={styles.fields}>
      <FormItem name={`${base}.headline`}>
        <FormLabel>Title</FormLabel>
        <FormControl>
          <Input
            value={item.headline}
            placeholder="e.g. RBI keeps the repo rate at 6.5%"
            onChange={(e) => update({ headline: e.target.value })}
          />
        </FormControl>
        <FormMessage />
      </FormItem>

      <FormItem name={`${base}.keyPoints`}>
        <FormLabel>Summary</FormLabel>
        <FormControl>
          <RichTextEditor
            value={item.keyPoints}
            onChange={(keyPoints) => update({ keyPoints })}
            placeholder="What happened and why it matters. Use bullets for the key facts."
            toolbarPreset="minimal"
            disableMediaUpload
            minHeight={140}
          />
        </FormControl>
        <FormMessage />
      </FormItem>

      <div className={styles.metaGrid}>
        <section className={styles.subsection}>
          <div className={styles.subsectionHead}>
            <h4 className={styles.subsectionTitle}>Topic tags</h4>
            {canCopyTags && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const merged = [...item.tags];
                  for (const tag of postTags) {
                    if (!merged.some((t) => t.kind === tag.kind && t.name === tag.name)) merged.push(tag);
                  }
                  update({ tags: merged });
                }}
              >
                <Tags size={14} /> Use digest tags
              </Button>
            )}
          </div>
          <CurrentAffairsTagPicker
            value={item.tags}
            onChange={(tags) => update({ tags })}
            options={tagOptions}
            kinds={[...tagKinds]}
            variant="compact"
            hideLabels={tagKinds.length === 1}
          />
        </section>

        <section className={styles.subsection}>
          <h4 className={styles.subsectionTitle}>Source link</h4>
          <CurrentAffairsSourcesEditor name={`${base}.sources`} value={item.sources} onChange={(sources) => update({ sources })} />
        </section>
      </div>

      {showImage && (
        <section className={styles.subsection}>
          <h4 className={styles.subsectionTitle}>Image (optional)</h4>
            <div className={styles.imageGrid}>
              <ImageUploader
                folder="current-affairs"
                currentImageUrl={item.imageUrl || undefined}
                currentFileId={item.imageFileId || undefined}
                aspectRatio="16 / 9"
                label="Upload item image"
                onSuccess={({ url, fileId }) => update({ imageUrl: url, imageFileId: fileId })}
              />
              <div className={styles.imageMeta}>
                <FormItem name={`${base}.imageAlt`}>
                  <FormLabel>Alt text</FormLabel>
                  <FormControl>
                    <Input
                      value={item.imageAlt}
                      placeholder="What the image shows"
                      onChange={(e) => update({ imageAlt: e.target.value })}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
                <FormItem name={`${base}.imageCredit`}>
                  <FormLabel>Image credit</FormLabel>
                  <FormControl>
                    <Input
                      value={item.imageCredit}
                      placeholder="e.g. PIB"
                      onChange={(e) => update({ imageCredit: e.target.value })}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </div>
            </div>
        </section>
      )}

      {showContext && (
        <section className={styles.subsection}>
          <h4 className={styles.subsectionTitle}>Extra context (optional)</h4>
          <FormItem name={`${base}.whyInNews`}>
            <FormLabel>Why it is in the news</FormLabel>
            <FormControl>
              <Textarea
                rows={2}
                value={item.whyInNews}
                placeholder="One line on what triggered the story."
                onChange={(e) => update({ whyInNews: e.target.value })}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
          <FormItem name={`${base}.background`}>
            <FormLabel>Background</FormLabel>
            <FormControl>
              <RichTextEditor
                value={item.background}
                onChange={(background) => update({ background })}
                placeholder="History, earlier decisions, constitutional provisions..."
                toolbarPreset="minimal"
                disableMediaUpload
                minHeight={100}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </section>
      )}

      {(!showImage || !showContext) && (
        <div className={styles.extras}>
          {!showImage && (
          <Button variant="outline" size="sm" onClick={() => setShowImage(true)} className={styles.addImage}>
            <ImagePlus size={14} /> Add an image
          </Button>
          )}
          {!showContext && (
            <Button variant="outline" size="sm" onClick={() => setShowContext(true)}>
              <AlignLeft size={14} /> Add context
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

const SortableItem: React.FC<{
  index: number;
  total: number;
  item: CurrentAffairsItemInput;
  expanded: boolean;
  issueCount: number;
  onToggle: () => void;
  onMove: (to: number) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  children: React.ReactNode;
}> = ({ index, total, item, expanded, issueCount, onToggle, onMove, onDuplicate, onRemove, children }) => {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: item.key,
  });
  const sourceCount = item.sources.filter((s) => s.url.trim()).length;
  const bodyId = `ca-item-${item.key}`;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`${styles.item} ${isDragging ? styles.dragging : ""} ${issueCount > 0 ? styles.itemInvalid : ""}`}
    >
      <div className={styles.itemHead}>
        <button
          type="button"
          ref={setActivatorNodeRef}
          className={styles.handle}
          aria-label={`Reorder item ${index + 1}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={16} />
        </button>
        <span className={styles.number}>{index + 1}</span>
        <button type="button" className={styles.headButton} onClick={onToggle} aria-expanded={expanded} aria-controls={bodyId}>
          <span className={`${styles.headline} ${item.headline.trim() ? "" : styles.headlineEmpty}`}>
            {item.headline.trim() || "Untitled item"}
          </span>
          <span className={styles.headMeta}>
            {issueCount > 0 && (
              <span className={styles.issueBadge}>
                <AlertCircle size={12} aria-hidden="true" /> {issueCount} to fix
              </span>
            )}
            <span>
              {sourceCount} source{sourceCount === 1 ? "" : "s"}
            </span>
            <ChevronDown size={16} className={`${styles.chevron} ${expanded ? styles.chevronOpen : ""}`} aria-hidden="true" />
          </span>
        </button>
        <div className={styles.itemActions}>
          <Button variant="ghost" size="icon-sm" disabled={index === 0} onClick={() => onMove(index - 1)} aria-label="Move up" title="Move up">
            <ArrowUp size={14} />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={index === total - 1}
            onClick={() => onMove(index + 1)}
            aria-label="Move down"
            title="Move down"
          >
            <ArrowDown size={14} />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={onDuplicate} aria-label="Duplicate item" title="Duplicate">
            <Copy size={14} />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={onRemove} aria-label="Delete item" title="Delete" className={styles.danger}>
            <Trash2 size={14} />
          </Button>
        </div>
      </div>
      {expanded && (
        <div id={bodyId} className={styles.itemBody}>
          {children}
        </div>
      )}
    </li>
  );
};

/*
 * The digest builder: an ordered list of items, each its own expandable editor. Bodies mount only
 * while open, so a twelve-item digest does not run twenty-four rich text editors at once.
 */
export const CurrentAffairsItemsEditor: React.FC<CurrentAffairsItemsEditorProps> = ({
  items,
  onChange,
  tagOptions,
  postTags,
  errors,
  mode = "list",
}) => {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(items.length === 1 ? [items[0].key] : []));
  const [confirmRemove, setConfirmRemove] = useState<number | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const itemErrors = (errors.items && typeof errors.items === "object" ? errors.items : {}) as FormErrorTree;
  const issueCounts = items.map((_, index) => countLeaves(itemErrors[String(index)]));
  const issueSignature = issueCounts.join(",");

  // Open any item that just picked up errors, so a failed publish lands on the problems.
  useEffect(() => {
    const withIssues = items.filter((_, index) => issueCounts[index] > 0).map((item) => item.key);
    if (withIssues.length === 0) return;
    setExpanded((prev) => {
      if (withIssues.every((key) => prev.has(key))) return prev;
      return new Set([...prev, ...withIssues]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issueSignature]);

  const update = (index: number, patch: Partial<CurrentAffairsItemInput>) =>
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  if (mode === "single") {
    const item = items[0];
    if (!item) return null;
    return (
      <ItemFields index={0} item={item} update={(patch) => update(0, patch)} tagOptions={tagOptions} postTags={postTags} />
    );
  }

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const move = (from: number, to: number) => onChange(arrayMove(items, from, to));

  const add = () => {
    const item = emptyCurrentAffairsItem();
    onChange([...items, item]);
    setExpanded((prev) => new Set([...prev, item.key]));
  };

  const duplicate = (index: number) => {
    const copy = { ...items[index], key: newKey(), headline: `${items[index].headline} (copy)`.trim() };
    const next = [...items];
    next.splice(index + 1, 0, copy);
    onChange(next);
    setExpanded((prev) => new Set([...prev, copy.key]));
  };

  const remove = (index: number) => onChange(items.filter((_, i) => i !== index));

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = items.findIndex((item) => item.key === active.id);
    const to = items.findIndex((item) => item.key === over.id);
    if (from >= 0 && to >= 0) move(from, to);
  };

  const { min, max } = currentAffairsMeta.DIGEST_TARGET;
  const inTarget = items.length >= min && items.length <= max;
  const allOpen = items.length > 0 && items.every((item) => expanded.has(item.key));

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <div className={styles.counter} aria-live="polite">
          <span className={`${styles.countPill} ${inTarget ? styles.countGood : ""}`}>
            {items.length} item{items.length === 1 ? "" : "s"}
          </span>
          <span className={styles.countHint}>
            {inTarget ? "Right in the" : items.length < min ? `${min - items.length} short of the` : `${items.length - max} over the`} {min}-{max} a
            digest usually carries
          </span>
        </div>
        {items.length > 1 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(allOpen ? new Set() : new Set(items.map((item) => item.key)))}
          >
            {allOpen ? <ChevronsDownUp size={14} /> : <ChevronsUpDown size={14} />}
            {allOpen ? "Collapse all" : "Expand all"}
          </Button>
        )}
      </div>

      <FormItem name="itemCount">
        <FormMessage />
      </FormItem>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((item) => item.key)} strategy={verticalListSortingStrategy}>
          <ol className={styles.list}>
            {items.map((item, index) => (
              <SortableItem
                key={item.key}
                index={index}
                total={items.length}
                item={item}
                expanded={expanded.has(item.key)}
                issueCount={issueCounts[index]}
                onToggle={() => toggle(item.key)}
                onMove={(to) => move(index, to)}
                onDuplicate={() => duplicate(index)}
                onRemove={() => (hasContent(item) ? setConfirmRemove(index) : remove(index))}
              >
                <ItemFields
                  index={index}
                  item={item}
                  update={(patch) => update(index, patch)}
                  tagOptions={tagOptions}
                  postTags={postTags}
                />
              </SortableItem>
            ))}
          </ol>
        </SortableContext>
      </DndContext>

      <Button variant="outline" onClick={add} className={styles.addItem}>
        <Plus size={16} /> Add item
      </Button>

      <ConsoleConfirmDialog
        open={confirmRemove !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmRemove(null);
        }}
        tone="destructive"
        icon={<Trash2 size={20} />}
        title="Delete this item?"
        description={
          confirmRemove !== null ? (
            <>
              <strong>{items[confirmRemove]?.headline || `Item ${confirmRemove + 1}`}</strong> and everything written in it is
              removed from the digest when you save.
            </>
          ) : null
        }
        confirmLabel="Delete item"
        onConfirm={() => {
          if (confirmRemove !== null) remove(confirmRemove);
          setConfirmRemove(null);
        }}
      />
    </div>
  );
};