import React, { useState } from "react";
import {
  useAdminCustomExamNamesQuery,
  useAdminCustomExamNameDuplicatesQuery,
  useUpdateCustomExamNameMutation,
  useMakeOfficialMutation,
  useDeleteCustomExamNameMutation,
  useMergeCustomExamNamesMutation,
} from "../helpers/useAdminCustomExamNames";
import { useAdminExamCategoriesQuery } from "../helpers/useAdminExamCategories";
import type { DuplicateGroup } from "../helpers/duplicateExamNames";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";
import { Input } from "./Input";
import { Textarea } from "./Textarea";
import { Checkbox } from "./Checkbox";
import { Badge } from "./Badge";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "./Select";
import { RadioGroup, RadioGroupItem } from "./RadioGroup";
import { Dialog } from "./Dialog";
import {
  ConsoleDialogContent,
  ConsoleDialogHeader,
  ConsoleDialogBody,
  ConsoleDialogFooter,
} from "./ConsoleDialog";
import { ConsoleConfirmDialog } from "./ConsoleConfirmDialog";
import { ConsoleListEmpty } from "./ConsoleListEmpty";
import { Form, useForm, FormItem, FormLabel, FormControl, FormMessage } from "./Form";
import { Edit, ShieldCheck, Trash2, FileText, GitMerge, Layers } from "lucide-react";
import * as z from "zod";
import styles from "./AdminCustomExamNamesTab.module.css";

const editSchema = z.object({
  newName: z.string().min(1, "New name is required"),
});

function EditDialog({
  customName,
  isOpen,
  onClose,
}: {
  customName: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  const mutation = useUpdateCustomExamNameMutation();
  const form = useForm({
    schema: editSchema,
    defaultValues: { newName: customName },
  });

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <ConsoleDialogContent size="sm">
        <ConsoleDialogHeader title="Edit custom name" description="Rename this custom exam name." />
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((data) => {
              mutation.mutate(
                { oldName: customName, newName: data.newName },
                { onSuccess: onClose }
              );
            })}
          >
            <ConsoleDialogBody>
              <FormItem name="newName" className={styles.formItem}>
                <FormLabel className={styles.formLabel}>New name</FormLabel>
                <FormControl>
                  <Input
                    value={form.values.newName}
                    onChange={(e) =>
                      form.setValues((prev) => ({ ...prev, newName: e.target.value }))
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            </ConsoleDialogBody>
            <ConsoleDialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Saving..." : "Save name"}
              </Button>
            </ConsoleDialogFooter>
          </form>
        </Form>
      </ConsoleDialogContent>
    </Dialog>
  );
}

const makeOfficialSchema = z.object({
  name: z.string().min(1, "Name is required"),
  fullName: z.string().optional(),
  categoryId: z.string().min(1, "Category is required"),
  description: z.string().optional(),
});

function MakeOfficialDialog({
  customName,
  isOpen,
  onClose,
}: {
  customName: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  const { data: categoriesData, isFetching } = useAdminExamCategoriesQuery();
  const mutation = useMakeOfficialMutation();

  const form = useForm({
    schema: makeOfficialSchema,
    defaultValues: { name: customName, fullName: customName, categoryId: "", description: "" },
  });

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <ConsoleDialogContent size="md">
        <ConsoleDialogHeader
          title="Make official"
          description="Convert this custom name into an official exam."
        />

        {isFetching ? (
          <ConsoleDialogBody>
            <Skeleton className={styles.fieldSkeleton} />
            <Skeleton className={styles.fieldSkeleton} />
          </ConsoleDialogBody>
        ) : (
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((data) => {
                mutation.mutate(
                  {
                    name: data.name,
                    fullName: data.fullName,
                    categoryId: parseInt(data.categoryId, 10),
                    description: data.description,
                  },
                  { onSuccess: onClose }
                );
              })}
            >
              <ConsoleDialogBody>
                <FormItem name="name" className={styles.formItem}>
                  <FormLabel className={styles.formLabel}>Exam name</FormLabel>
                  <FormControl>
                    <Input
                      value={form.values.name}
                      onChange={(e) =>
                        form.setValues((prev) => ({ ...prev, name: e.target.value }))
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>

                <FormItem name="fullName" className={styles.formItem}>
                  <FormLabel className={styles.formLabel}>Full name (optional)</FormLabel>
                  <FormControl>
                    <Input
                      value={form.values.fullName || ""}
                      onChange={(e) =>
                        form.setValues((prev) => ({ ...prev, fullName: e.target.value }))
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>

                <FormItem name="categoryId" className={styles.formItem}>
                  <FormLabel className={styles.formLabel}>Category</FormLabel>
                  <FormControl>
                    <Select
                      value={form.values.categoryId}
                      onValueChange={(val) =>
                        form.setValues((prev) => ({ ...prev, categoryId: val }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {categoriesData?.categories.map((c) => (
                            <SelectItem key={c.id} value={c.id.toString()}>
                              {c.categoryName}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>

                <FormItem name="description" className={styles.formItem}>
                  <FormLabel className={styles.formLabel}>Description (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      value={form.values.description || ""}
                      onChange={(e) =>
                        form.setValues((prev) => ({ ...prev, description: e.target.value }))
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </ConsoleDialogBody>

              <ConsoleDialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? "Saving..." : "Make official"}
                </Button>
              </ConsoleDialogFooter>
            </form>
          </Form>
        )}
      </ConsoleDialogContent>
    </Dialog>
  );
}

function DeleteDialog({
  customName,
  isOpen,
  onClose,
}: {
  customName: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  const mutation = useDeleteCustomExamNameMutation();

  if (!isOpen) return null;

  return (
    <ConsoleConfirmDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      tone="destructive"
      icon={<Trash2 size={20} />}
      title="Delete this custom name?"
      description={
        <>
          <strong>"{customName}"</strong> will be removed from all tests and products using it. This cannot be undone.
        </>
      }
      confirmLabel="Delete name"
      pendingLabel="Deleting..."
      isPending={mutation.isPending}
      onConfirm={() => mutation.mutate({ name: customName }, { onSuccess: onClose })}
    />
  );
}

function MergeGroupDialog({
  group,
  isOpen,
  onClose,
}: {
  group: DuplicateGroup;
  isOpen: boolean;
  onClose: () => void;
}) {
  const { data: categoriesData, isFetching: isFetchingCategories } = useAdminExamCategoriesQuery();
  const mergeMutation = useMergeCustomExamNamesMutation();
  const makeOfficialMutation = useMakeOfficialMutation();

  const [selected, setSelected] = useState<Set<string>>(new Set(group.members.map((m) => m.name)));
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [targetExamId, setTargetExamId] = useState<string>("");
  const [newExamForm, setNewExamForm] = useState({
    name: group.suggestedCanonicalName,
    fullName: group.suggestedCanonicalName,
    categoryId: "",
    description: "",
  });

  const isSubmitting = mergeMutation.isPending || makeOfficialMutation.isPending;
  const selectedCount = selected.size;

  const toggleMember = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleSubmit = async () => {
    const sourceNames = Array.from(selected);
    if (sourceNames.length === 0) return;

    try {
      if (mode === "existing") {
        if (!targetExamId) return;
        await mergeMutation.mutateAsync({ sourceNames, targetExamId: parseInt(targetExamId, 10) });
      } else {
        if (!newExamForm.name.trim() || !newExamForm.categoryId) return;
        const created = await makeOfficialMutation.mutateAsync({
          name: newExamForm.name,
          fullName: newExamForm.fullName || undefined,
          categoryId: parseInt(newExamForm.categoryId, 10),
          description: newExamForm.description || undefined,
        });
        // Safe even if the new exam's name exactly matched one of the
        // selected names - make-official already claimed it, so this pass
        // just finds nothing left for that particular name.
        await mergeMutation.mutateAsync({ sourceNames, targetExamId: created.examId });
      }
      onClose();
    } catch {
      // Errors are already surfaced via toast by the mutations.
    }
  };

  if (!isOpen) return null;

  const examOptions = (categoriesData?.categories ?? []).map((category) => ({
    category,
    exams: category.exams,
  }));

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <ConsoleDialogContent size="md">
        <ConsoleDialogHeader
          title="Merge duplicate names"
          description="These look like the same exam. Pick which names to fold together and where they should point."
        />

        <ConsoleDialogBody>
          <div className={styles.mergeMemberList}>
            {group.members.map((member) => (
              <label key={member.name} className={styles.mergeMemberRow}>
                <Checkbox
                  checked={selected.has(member.name)}
                  onChange={() => toggleMember(member.name)}
                />
                <span className={styles.mergeMemberName}>{member.name}</span>
                <span className={styles.mergeMemberStats}>
                  {member.mockTestCount} tests, {member.productCount} notes
                </span>
              </label>
            ))}
          </div>

          <RadioGroup value={mode} onValueChange={(v) => setMode(v as "existing" | "new")} className={styles.mergeModeGroup}>
            <label className={styles.mergeModeOption}>
              <RadioGroupItem value="existing" />
              <span>Merge into an existing exam</span>
            </label>
            <label className={styles.mergeModeOption}>
              <RadioGroupItem value="new" />
              <span>Create a new official exam</span>
            </label>
          </RadioGroup>

          {mode === "existing" ? (
            isFetchingCategories ? (
              <Skeleton className={styles.fieldSkeleton} />
            ) : (
              <Select value={targetExamId} onValueChange={setTargetExamId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select the exam to merge into" />
                </SelectTrigger>
                <SelectContent>
                  {examOptions.map(({ category, exams }) =>
                    exams.length > 0 ? (
                      <SelectGroup key={category.id}>
                        <SelectLabel>{category.categoryName}</SelectLabel>
                        {exams.map((exam) => (
                          <SelectItem key={exam.id} value={exam.id.toString()}>
                            {exam.fullName || exam.examName}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ) : null
                  )}
                </SelectContent>
              </Select>
            )
          ) : (
            <div className={styles.newExamFields}>
              <div className={styles.mergeField}>
                <label htmlFor="merge-group-name" className={styles.mergeLabel}>
                  Exam name
                </label>
                <Input
                  id="merge-group-name"
                  value={newExamForm.name}
                  onChange={(e) => setNewExamForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className={styles.mergeField}>
                <label htmlFor="merge-group-full-name" className={styles.mergeLabel}>
                  Full name (optional)
                </label>
                <Input
                  id="merge-group-full-name"
                  value={newExamForm.fullName}
                  onChange={(e) => setNewExamForm((prev) => ({ ...prev, fullName: e.target.value }))}
                />
              </div>
              <div className={styles.mergeField}>
                <label htmlFor="merge-group-category" className={styles.mergeLabel}>
                  Category
                </label>
                {isFetchingCategories ? (
                  <Skeleton className={styles.fieldSkeleton} />
                ) : (
                  <Select
                    value={newExamForm.categoryId}
                    onValueChange={(val) => setNewExamForm((prev) => ({ ...prev, categoryId: val }))}
                  >
                    <SelectTrigger id="merge-group-category">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {categoriesData?.categories.map((c) => (
                          <SelectItem key={c.id} value={c.id.toString()}>
                            {c.categoryName}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className={styles.mergeField}>
                <label htmlFor="merge-group-description" className={styles.mergeLabel}>
                  Description (optional)
                </label>
                <Textarea
                  id="merge-group-description"
                  value={newExamForm.description}
                  onChange={(e) => setNewExamForm((prev) => ({ ...prev, description: e.target.value }))}
                />
              </div>
            </div>
          )}
        </ConsoleDialogBody>

        <ConsoleDialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={
              isSubmitting ||
              selectedCount === 0 ||
              (mode === "existing" ? !targetExamId : !newExamForm.name.trim() || !newExamForm.categoryId)
            }
          >
            {isSubmitting ? "Merging..." : `Merge ${selectedCount} name${selectedCount === 1 ? "" : "s"}`}
          </Button>
        </ConsoleDialogFooter>
      </ConsoleDialogContent>
    </Dialog>
  );
}

// Manual merge for a single custom name into any official exam - the
// "Suggested duplicates" panel only surfaces names that look alike by
// spelling, but plenty of real duplicates don't (e.g. a custom "NEET" and
// the official "NEET UG" share no obvious string similarity). This gives
// admins a way to merge any custom name into any official exam directly,
// without waiting on the suggestion algorithm to catch it.
function MergeIntoExamDialog({
  customName,
  isOpen,
  onClose,
}: {
  customName: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  const { data: categoriesData, isFetching: isFetchingCategories } = useAdminExamCategoriesQuery();
  const mergeMutation = useMergeCustomExamNamesMutation();
  const [targetExamId, setTargetExamId] = useState<string>("");
  const [search, setSearch] = useState("");

  if (!isOpen) return null;

  const normalizedSearch = search.trim().toLowerCase();
  const examOptions = (categoriesData?.categories ?? [])
    .map((category) => ({
      category,
      exams: category.exams.filter(
        (exam) =>
          !normalizedSearch ||
          exam.examName.toLowerCase().includes(normalizedSearch) ||
          exam.fullName.toLowerCase().includes(normalizedSearch)
      ),
    }))
    .filter((group) => group.exams.length > 0);

  const handleSubmit = async () => {
    if (!targetExamId) return;
    try {
      await mergeMutation.mutateAsync({ sourceNames: [customName], targetExamId: parseInt(targetExamId, 10) });
      onClose();
    } catch {
      // Errors are already surfaced via toast by the mutation.
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <ConsoleDialogContent size="md">
        <ConsoleDialogHeader
          title="Merge into existing exam"
          description={
            <>
              Fold <strong>"{customName}"</strong> into an official exam. All tests and notes currently under this name will move to the exam you pick, and the custom name will stop appearing in this list.
            </>
          }
        />

        <ConsoleDialogBody>
          {isFetchingCategories ? (
            <Skeleton className={styles.fieldSkeleton} />
          ) : (
            <div className={styles.mergeField}>
              <label htmlFor="merge-target-exam" className={styles.mergeLabel}>
                Target exam
              </label>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search exams..."
                aria-label="Search exams"
              />
              <Select value={targetExamId} onValueChange={setTargetExamId}>
                <SelectTrigger id="merge-target-exam">
                  <SelectValue placeholder="Select the exam to merge into" />
                </SelectTrigger>
                <SelectContent>
                  {examOptions.length === 0 ? (
                    <div className={styles.selectEmpty}>No exams match "{search}".</div>
                  ) : (
                    examOptions.map(({ category, exams }) => (
                      <SelectGroup key={category.id}>
                        <SelectLabel>{category.categoryName}</SelectLabel>
                        {exams.map((exam) => (
                          <SelectItem key={exam.id} value={exam.id.toString()}>
                            {exam.fullName || exam.examName}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}
        </ConsoleDialogBody>

        <ConsoleDialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={mergeMutation.isPending || !targetExamId}>
            {mergeMutation.isPending ? "Merging..." : "Merge name"}
          </Button>
        </ConsoleDialogFooter>
      </ConsoleDialogContent>
    </Dialog>
  );
}

function DuplicateGroupsSection() {
  const { data, isFetching } = useAdminCustomExamNameDuplicatesQuery();
  const [mergeGroup, setMergeGroup] = useState<DuplicateGroup | null>(null);

  if (isFetching) {
    return <Skeleton style={{ height: "5rem", borderRadius: "var(--radius-md)", marginBottom: "var(--spacing-6)" }} />;
  }

  if (!data?.groups || data.groups.length === 0) {
    return null;
  }

  return (
    <div className={styles.duplicatesSection}>
      <div className={styles.duplicatesHeader}>
        <Layers size={18} />
        <h3>Suggested duplicates</h3>
        <span className={styles.duplicatesCount}>{data.groups.length}</span>
      </div>
      <p className={styles.duplicatesHint}>
        These names look like the same exam based on spelling and word overlap. Review and merge - nothing happens
        automatically.
      </p>
      <div className={styles.duplicatesList}>
        {data.groups.map((group) => (
          <div key={group.id} className={styles.duplicateCard}>
            <div className={styles.duplicateMembers}>
              <Badge variant={group.confidence === "exact" ? "secondary" : "outline"}>
                {group.confidence === "exact" ? "Likely identical" : "Similar"}
              </Badge>
              {group.members.map((m) => (
                <span key={m.name} className={styles.duplicateChip}>
                  {m.name}
                  <span className={styles.duplicateChipCount}>
                    {m.mockTestCount + m.productCount}
                  </span>
                </span>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={() => setMergeGroup(group)}>
              <GitMerge size={14} /> Review and merge
            </Button>
          </div>
        ))}
      </div>

      {mergeGroup && (
        <MergeGroupDialog group={mergeGroup} isOpen={true} onClose={() => setMergeGroup(null)} />
      )}
    </div>
  );
}

export function AdminCustomExamNamesTab() {
  const { data, isFetching } = useAdminCustomExamNamesQuery();

  const [editName, setEditName] = useState<string | null>(null);
  const [officialName, setOfficialName] = useState<string | null>(null);
  const [deleteName, setDeleteName] = useState<string | null>(null);
  const [mergeName, setMergeName] = useState<string | null>(null);

  if (isFetching) {
    return (
      <div className={styles.container}>
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className={styles.cardSkeleton} />
        ))}
      </div>
    );
  }

  if (!data?.customNames || data.customNames.length === 0) {
    return (
      <div className={styles.container}>
        <ConsoleListEmpty
          icon={<FileText size={24} />}
          title="No custom exam names yet"
          description="Names teachers type in instead of picking an official exam show up here."
        />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <DuplicateGroupsSection />
      <div className={styles.list}>
        {data.customNames.map((item) => (
          <div key={item.name} className={styles.card}>
            <div className={styles.info}>
              <div className={styles.name}>{item.name}</div>
              <div className={styles.stats}>
                {item.mockTestCount} tests, {item.productCount} notes, {item.liveTestCount} live
              </div>
            </div>
            <div className={styles.actions}>
              <Button
                variant="ghost"
                size="icon-md"
                onClick={() => setEditName(item.name)}
                title="Edit name"
                aria-label={`Edit ${item.name}`}
              >
                <Edit size={16} />
              </Button>
              <Button
                variant="ghost"
                size="icon-md"
                onClick={() => setOfficialName(item.name)}
                title="Make official (new exam)"
                aria-label={`Make ${item.name} an official exam`}
              >
                <ShieldCheck size={16} />
              </Button>
              <Button
                variant="ghost"
                size="icon-md"
                onClick={() => setMergeName(item.name)}
                title="Merge into existing exam"
                aria-label={`Merge ${item.name} into an existing exam`}
              >
                <GitMerge size={16} />
              </Button>
              <Button
                variant="ghost"
                size="icon-md"
                className={styles.deleteBtn}
                onClick={() => setDeleteName(item.name)}
                title="Delete"
                aria-label={`Delete ${item.name}`}
              >
                <Trash2 size={16} />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {editName && (
        <EditDialog
          customName={editName}
          isOpen={true}
          onClose={() => setEditName(null)}
        />
      )}
      {officialName && (
        <MakeOfficialDialog
          customName={officialName}
          isOpen={true}
          onClose={() => setOfficialName(null)}
        />
      )}
      {deleteName && (
        <DeleteDialog
          customName={deleteName}
          isOpen={true}
          onClose={() => setDeleteName(null)}
        />
      )}
      {mergeName && (
        <MergeIntoExamDialog
          customName={mergeName}
          isOpen={true}
          onClose={() => setMergeName(null)}
        />
      )}
    </div>
  );
}