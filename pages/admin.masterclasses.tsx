import React, { useState } from "react";
import { Helmet } from "react-helmet";
import { toast } from "sonner";
import { z } from "zod";
import {
  useAdminMasterclassesQuery,
  useAdminMasterclassRegistrationsQuery,
  useUpsertMasterclassMutation,
  useMarkMasterclassAttendedMutation,
} from "../helpers/useAdminMasterclasses";
import { AdminMasterclassRow } from "../endpoints/admin/masterclasses/list_GET.schema";
import { ConsolePageHeader } from "../components/ConsolePageHeader";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { Input } from "../components/Input";
import { Textarea } from "../components/Textarea";
import { Switch } from "../components/Switch";
import { ImageUploader } from "../components/ImageUploader";
import { Skeleton } from "../components/Skeleton";
import { Dialog } from "../components/Dialog";
import { ConsoleDialogContent, ConsoleDialogHeader, ConsoleDialogBody, ConsoleDialogFooter } from "../components/ConsoleDialog";
import { Form, FormItem, FormLabel, FormControl, FormMessage, FormDescription, useForm } from "../components/Form";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectItem } from "../components/Select";
import { Plus, Edit2, Users, GraduationCap } from "lucide-react";
import tableStyles from "../components/AdminSubscriptionPlansManager.module.css";
import styles from "./admin.masterclasses.module.css";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

const statusVariant = (status: string): "success" | "secondary" | "destructive" | "outline" => {
  if (status === "published") return "success";
  if (status === "cancelled") return "destructive";
  return "secondary";
};

const formatDateTime = (date: Date | string) =>
  new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(
    new Date(date)
  );

// datetime-local inputs want "YYYY-MM-DDTHH:mm" in local time, with no timezone suffix.
const toDateTimeLocal = (date: Date | string | null): string => {
  if (!date) return "";
  const d = new Date(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const AdminMasterclassesPage: React.FC = () => {
  const { data, isFetching } = useAdminMasterclassesQuery();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<AdminMasterclassRow | null>(null);
  const [registrantsTarget, setRegistrantsTarget] = useState<AdminMasterclassRow | null>(null);

  const handleCreate = () => {
    setEditingRow(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (row: AdminMasterclassRow) => {
    setEditingRow(row);
    setIsDialogOpen(true);
  };

  return (
    <>
      <Helmet>
        <title>Masterclasses - Testkart Admin</title>
      </Helmet>
      <div className={styles.page}>
        <ConsolePageHeader title="Masterclasses">
          <Button onClick={handleCreate}>
            <Plus size={16} /> Create masterclass
          </Button>
        </ConsolePageHeader>

        <div className={tableStyles.results}>
          {isFetching && !data ? (
            <div className={tableStyles.tableContainer} style={{ display: "block" }}>
              <table className={tableStyles.table}>
                <tbody>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i}>
                      <td><Skeleton style={{ height: "0.875rem", width: "70%" }} /></td>
                      <td><Skeleton style={{ height: "0.875rem", width: "50%" }} /></td>
                      <td><Skeleton style={{ height: "1.125rem", width: "4rem" }} /></td>
                      <td><Skeleton style={{ height: "1.5rem", width: "5rem", marginLeft: "auto" }} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : !data || data.masterclasses.length === 0 ? (
            <p className={tableStyles.emptyState}>
              No masterclasses yet. Create one to start taking registrations at /masterclass.
            </p>
          ) : (
            <div className={tableStyles.tableContainer} style={{ display: "block" }}>
              <table className={tableStyles.table}>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Starts</th>
                    <th>Status</th>
                    <th>Registrants</th>
                    <th><span className={tableStyles.srOnly}>Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {data.masterclasses.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <div className={tableStyles.stack}>
                          <span className={tableStyles.primaryLine}>
                            <span className={tableStyles.truncate} title={m.title}>{m.title}</span>
                          </span>
                          <span className={tableStyles.secondaryLine}>/masterclass/{m.slug}</span>
                        </div>
                      </td>
                      <td>
                        <span className={tableStyles.valueLine}>{formatDateTime(m.startTime)}</span>
                      </td>
                      <td>
                        <Badge variant={statusVariant(m.status)} className={tableStyles.flag}>
                          {m.status}
                        </Badge>
                      </td>
                      <td>
                        <span className={tableStyles.valueLine}>
                          {m.registrantCount}
                          {m.capacity !== null ? ` / ${m.capacity}` : ""}
                        </span>
                        <span className={tableStyles.secondaryLine}>{m.attendedCount} attended</span>
                      </td>
                      <td>
                        <div className={tableStyles.rowActions}>
                          <Button
                            variant="ghost"
                            size="icon-md"
                            className={tableStyles.iconButton}
                            aria-label={`View registrants for ${m.title}`}
                            onClick={() => setRegistrantsTarget(m)}
                          >
                            <Users />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-md"
                            className={tableStyles.iconButton}
                            aria-label={`Edit ${m.title}`}
                            onClick={() => handleEdit(m)}
                          >
                            <Edit2 />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <MasterclassEditorDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} row={editingRow} />
      <RegistrantsDialog
        open={!!registrantsTarget}
        onOpenChange={(open) => !open && setRegistrantsTarget(null)}
        masterclass={registrantsTarget}
      />
    </>
  );
};

export default AdminMasterclassesPage;

const masterclassFormSchema = z.object({
  id: z.number().optional(),
  slug: z.string().trim().min(3, "At least 3 characters").regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and hyphens only"),
  title: z.string().trim().min(3, "Title is required"),
  subtitle: z.string().optional(),
  description: z.string().optional(),
  coverImageUrl: z.string().optional(),
  coverImageFileId: z.string().optional(),
  hostName: z.string().optional(),
  hostTitle: z.string().optional(),
  hostImageUrl: z.string().optional(),
  platformLabel: z.string().optional(),
  joinUrl: z.string().optional(),
  startTime: z.string().refine((v) => !isNaN(new Date(v).getTime()), "Pick a start date and time"),
  durationMinutes: z.string().refine((v) => v === "" || (!isNaN(parseInt(v, 10)) && parseInt(v, 10) > 0), "Must be a positive number"),
  capacity: z.string().refine((v) => v === "" || (!isNaN(parseInt(v, 10)) && parseInt(v, 10) > 0), "Must be a positive number"),
  status: z.enum(["draft", "published", "cancelled"]),
});
type MasterclassFormData = z.infer<typeof masterclassFormSchema>;

const MasterclassEditorDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: AdminMasterclassRow | null;
}> = ({ open, onOpenChange, row }) => {
  const upsertMutation = useUpsertMasterclassMutation();
  const [slugTouched, setSlugTouched] = useState(false);

  const defaultValues: MasterclassFormData = {
    id: row?.id,
    slug: row?.slug || "",
    title: row?.title || "",
    subtitle: row?.subtitle || "",
    description: row?.description || "",
    coverImageUrl: row?.coverImageUrl || "",
    coverImageFileId: row?.coverImageFileId || "",
    hostName: row?.hostName || "",
    hostTitle: row?.hostTitle || "",
    hostImageUrl: row?.hostImageUrl || "",
    platformLabel: row?.platformLabel || "",
    joinUrl: row?.joinUrl || "",
    startTime: toDateTimeLocal(row?.startTime ?? null),
    durationMinutes: row?.durationMinutes != null ? String(row.durationMinutes) : "60",
    capacity: row?.capacity != null ? String(row.capacity) : "",
    status: (row?.status as "draft" | "published" | "cancelled") || "draft",
  };

  const form = useForm<typeof masterclassFormSchema>({ schema: masterclassFormSchema, defaultValues });

  React.useEffect(() => {
    if (open) {
      form.setValues(defaultValues);
      setSlugTouched(!!row);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, row?.id]);

  const handleTitleChange = (title: string) => {
    form.setValues((prev) => ({
      ...prev,
      title,
      slug: slugTouched ? prev.slug : slugify(title),
    }));
  };

  const handleSubmit = (data: MasterclassFormData) => {
    upsertMutation.mutate(
      {
        id: data.id,
        slug: data.slug,
        title: data.title,
        subtitle: data.subtitle || undefined,
        description: data.description || undefined,
        coverImageUrl: data.coverImageUrl || undefined,
        coverImageFileId: data.coverImageFileId || undefined,
        hostName: data.hostName || undefined,
        hostTitle: data.hostTitle || undefined,
        hostImageUrl: data.hostImageUrl || undefined,
        platformLabel: data.platformLabel || undefined,
        joinUrl: data.joinUrl || undefined,
        startTime: new Date(data.startTime),
        durationMinutes: data.durationMinutes ? parseInt(data.durationMinutes, 10) : undefined,
        capacity: data.capacity ? parseInt(data.capacity, 10) : null,
        status: data.status,
      },
      {
        onSuccess: () => {
          toast.success(row ? "Masterclass updated." : "Masterclass created.");
          onOpenChange(false);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save the masterclass."),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ConsoleDialogContent size="lg">
        <ConsoleDialogHeader
          title={row ? "Edit masterclass" : "Create masterclass"}
          description="Shown publicly at /masterclass once published."
        />
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <ConsoleDialogBody>
              <div className={styles.dialogFields}>
                <FormItem name="title">
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input value={form.values.title} onChange={(e) => handleTitleChange(e.target.value)} placeholder="e.g. Growing Your Teaching Business" />
                  </FormControl>
                  <FormMessage />
                </FormItem>

                <FormItem name="slug">
                  <FormLabel>URL slug</FormLabel>
                  <FormControl>
                    <Input
                      value={form.values.slug}
                      onChange={(e) => {
                        setSlugTouched(true);
                        form.setValues((prev) => ({ ...prev, slug: slugify(e.target.value) }));
                      }}
                      placeholder="growing-your-teaching-business"
                    />
                  </FormControl>
                  <FormDescription>testkart.in/masterclass/{form.values.slug || "..."}</FormDescription>
                  <FormMessage />
                </FormItem>

                <FormItem name="subtitle">
                  <FormLabel>Subtitle (optional)</FormLabel>
                  <FormControl>
                    <Input value={form.values.subtitle || ""} onChange={(e) => form.setValues((prev) => ({ ...prev, subtitle: e.target.value }))} placeholder="One line shown on cards" />
                  </FormControl>
                  <FormMessage />
                </FormItem>

                <FormItem name="description">
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Textarea rows={4} value={form.values.description || ""} onChange={(e) => form.setValues((prev) => ({ ...prev, description: e.target.value }))} placeholder="What teachers will learn" />
                  </FormControl>
                  <FormMessage />
                </FormItem>

                <FormItem name="coverImageUrl">
                  <FormLabel>Cover image (optional)</FormLabel>
                  <FormControl>
                    <ImageUploader
                      folder="masterclass-covers"
                      label="Upload cover image"
                      aspectRatio="16 / 9"
                      currentImageUrl={form.values.coverImageUrl || undefined}
                      currentFileId={form.values.coverImageFileId || undefined}
                      onSuccess={(result) =>
                        form.setValues((prev) => ({ ...prev, coverImageUrl: result.url, coverImageFileId: result.fileId }))
                      }
                    />
                  </FormControl>
                  <FormDescription>Shown on the /masterclass cards and the event page. 16:9 works best.</FormDescription>
                  <FormMessage />
                </FormItem>

                <div className={styles.formRow}>
                  <FormItem name="hostName" className={styles.flex1}>
                    <FormLabel>Host name (optional)</FormLabel>
                    <FormControl>
                      <Input value={form.values.hostName || ""} onChange={(e) => form.setValues((prev) => ({ ...prev, hostName: e.target.value }))} placeholder="Who's teaching" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                  <FormItem name="hostTitle" className={styles.flex1}>
                    <FormLabel>Host title (optional)</FormLabel>
                    <FormControl>
                      <Input value={form.values.hostTitle || ""} onChange={(e) => form.setValues((prev) => ({ ...prev, hostTitle: e.target.value }))} placeholder="e.g. Head of Growth" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                </div>

                <div className={styles.formRow}>
                  <FormItem name="platformLabel" className={styles.flex1}>
                    <FormLabel>Platform (optional)</FormLabel>
                    <FormControl>
                      <Input value={form.values.platformLabel || ""} onChange={(e) => form.setValues((prev) => ({ ...prev, platformLabel: e.target.value }))} placeholder="Google Meet, YouTube Live..." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                  <FormItem name="joinUrl" className={styles.flex1}>
                    <FormLabel>Join link</FormLabel>
                    <FormControl>
                      <Input value={form.values.joinUrl || ""} onChange={(e) => form.setValues((prev) => ({ ...prev, joinUrl: e.target.value }))} placeholder="https://meet.google.com/..." />
                    </FormControl>
                    <FormDescription>Shown to registrants and emailed in the 1-hour reminder.</FormDescription>
                    <FormMessage />
                  </FormItem>
                </div>

                <div className={styles.formRow}>
                  <FormItem name="startTime" className={styles.flex1}>
                    <FormLabel>Starts at</FormLabel>
                    <FormControl>
                      <Input
                        type="datetime-local"
                        value={form.values.startTime}
                        onChange={(e) => form.setValues((prev) => ({ ...prev, startTime: e.target.value }))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                  <FormItem name="durationMinutes" className={styles.flex1}>
                    <FormLabel>Duration (minutes)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        value={form.values.durationMinutes}
                        onChange={(e) => form.setValues((prev) => ({ ...prev, durationMinutes: e.target.value }))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                </div>

                <div className={styles.formRow}>
                  <FormItem name="capacity" className={styles.flex1}>
                    <FormLabel>Capacity (optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        placeholder="Unlimited"
                        value={form.values.capacity}
                        onChange={(e) => form.setValues((prev) => ({ ...prev, capacity: e.target.value }))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                  <FormItem name="status" className={styles.flex1}>
                    <FormLabel>Status</FormLabel>
                    <FormControl>
                      <Select value={form.values.status} onValueChange={(val: any) => form.setValues((prev) => ({ ...prev, status: val }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="draft">Draft (hidden)</SelectItem>
                            <SelectItem value="published">Published (open for registration)</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                </div>
              </div>
            </ConsoleDialogBody>
            <ConsoleDialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={upsertMutation.isPending}>
                {upsertMutation.isPending ? "Saving..." : row ? "Save changes" : "Create masterclass"}
              </Button>
            </ConsoleDialogFooter>
          </form>
        </Form>
      </ConsoleDialogContent>
    </Dialog>
  );
};

const RegistrantsDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  masterclass: AdminMasterclassRow | null;
}> = ({ open, onOpenChange, masterclass }) => {
  const { data, isFetching } = useAdminMasterclassRegistrationsQuery(masterclass?.id ?? null);
  const markAttendedMutation = useMarkMasterclassAttendedMutation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ConsoleDialogContent size="lg">
        <ConsoleDialogHeader title={`Registrants — ${masterclass?.title ?? ""}`} description="Everyone who signed up, with reminder and attendance status." />
        <ConsoleDialogBody>
          {isFetching && !data ? (
            <Skeleton style={{ height: "8rem", width: "100%" }} />
          ) : !data || data.registrations.length === 0 ? (
            <p className={tableStyles.emptyState}>
              <Users size={18} /> No one has registered yet.
            </p>
          ) : (
            <div>
              {data.registrations.map((r) => (
                <div key={r.id} className={styles.registrantRow}>
                  <div className={styles.registrantInfo}>
                    <span className={styles.registrantName}>{r.name}</span>
                    <span className={styles.registrantMeta}>
                      {r.email}
                      {r.phone ? ` · ${r.phone}` : ""}
                    </span>
                    <div className={styles.registrantBadges}>
                      {r.confirmationSentAt && <Badge variant="secondary" className={tableStyles.flag}>Confirmed</Badge>}
                      {r.reminder1DaySentAt && <Badge variant="secondary" className={tableStyles.flag}>1-day sent</Badge>}
                      {r.reminder1HourSentAt && <Badge variant="secondary" className={tableStyles.flag}>1-hr sent</Badge>}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-2)" }}>
                    <span className={styles.registrantMeta}>Attended</span>
                    <Switch
                      checked={!!r.attended}
                      onCheckedChange={(checked) => markAttendedMutation.mutate({ registrationId: r.id, attended: checked })}
                      disabled={markAttendedMutation.isPending}
                      aria-label={`Mark ${r.name} as attended`}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </ConsoleDialogBody>
        <ConsoleDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </ConsoleDialogFooter>
      </ConsoleDialogContent>
    </Dialog>
  );
};
