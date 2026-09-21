import React, { useState } from "react";
import {
  useAdminsList,
  useCreateAdmin,
  useUpdateAdminRole,
  useDeactivateAdmin,
  useUpdateAdminPermissions,
} from "../helpers/useAdminManagement";
import { useAdminAuth } from "../helpers/useAdminAuth";
import { Shield, MoreHorizontal, UserPlus, KeyRound } from "lucide-react";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Dialog } from "./Dialog";
import {
  ConsoleDialogContent,
  ConsoleDialogHeader,
  ConsoleDialogBody,
  ConsoleDialogFooter,
} from "./ConsoleDialog";
import {
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  useForm,
} from "./Form";
import { Input } from "./Input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./Select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "./DropdownMenu";
import { Skeleton } from "./Skeleton";
import { SortableTh } from "./SortableTh";
import { useTableSort, type SortAccessors } from "../helpers/useTableSort";
import { toast } from "sonner";
import * as z from "zod";
import { AdminRole, AdminRoleArrayValues } from "../helpers/schema";
import { AdminListItem } from "../endpoints/admin/admins/list_GET.schema";
import { AdminAccessChecklist } from "./AdminAccessChecklist";
import {
  ADMIN_MODULE_KEYS,
  normalizeAdminPermissions,
  type AdminModule,
} from "../helpers/adminPermissions";
import styles from "./AdminManagementSection.module.css";

const createAdminSchema = z.object({
  email: z.string().email("Invalid email address"),
  fullName: z.string().min(1, "Full name is required"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(64, "Password must be 64 characters or fewer"),
  role: z.enum(AdminRoleArrayValues),
  permissions: z.array(z.enum(ADMIN_MODULE_KEYS as [AdminModule, ...AdminModule[]])),
});

const EMPTY_ADMIN = {
  email: "",
  fullName: "",
  password: "",
  role: "admin" as AdminRole,
  permissions: [] as AdminModule[],
};

const CreateAdminDialog = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const form = useForm({
    schema: createAdminSchema,
    defaultValues: EMPTY_ADMIN,
  });

  const createAdmin = useCreateAdmin();

  const onSubmit = (values: z.infer<typeof createAdminSchema>) => {
    createAdmin.mutate(values, {
      onSuccess: () => {
        toast.success("Admin created successfully");
        onOpenChange(false);
        form.setValues(EMPTY_ADMIN);
      },
      onError: (error) => {
        toast.error(
          error instanceof Error ? error.message : "Failed to create admin"
        );
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ConsoleDialogContent size="lg">
        <ConsoleDialogHeader
          title="Create admin"
          description="Add a new administrator and choose which sections they can open."
        />
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <ConsoleDialogBody>
              <FormItem name="fullName">
                <FormLabel>Full name</FormLabel>
                <FormControl>
                  <Input
                    value={form.values.fullName}
                    onChange={(e) =>
                      form.setValues((v) => ({ ...v, fullName: e.target.value }))
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
              <FormItem name="email">
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    value={form.values.email}
                    onChange={(e) =>
                      form.setValues((v) => ({ ...v, email: e.target.value }))
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
              <FormItem name="password">
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    value={form.values.password}
                    onChange={(e) =>
                      form.setValues((v) => ({ ...v, password: e.target.value }))
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
              <FormItem name="role">
                <FormLabel>Role</FormLabel>
                <FormControl>
                  <Select
                    value={form.values.role}
                    onValueChange={(val: any) =>
                      form.setValues((v) => ({ ...v, role: val }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      {AdminRoleArrayValues.map((role) => (
                        <SelectItem key={role} value={role}>
                          {role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
              <FormItem name="permissions">
                <FormLabel>Access</FormLabel>
                <AdminAccessChecklist
                  value={form.values.permissions}
                  onChange={(permissions) => form.setValues((v) => ({ ...v, permissions }))}
                />
                <FormMessage />
              </FormItem>
            </ConsoleDialogBody>
            <ConsoleDialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createAdmin.isPending}>
                Create admin
              </Button>
            </ConsoleDialogFooter>
          </form>
        </Form>
      </ConsoleDialogContent>
    </Dialog>
  );
};

const EditAccessDialog = ({
  admin,
  onOpenChange,
}: {
  admin: AdminListItem | null;
  onOpenChange: (open: boolean) => void;
}) => {
  const updatePermissions = useUpdateAdminPermissions();
  const [draft, setDraft] = useState<AdminModule[]>([]);
  const [draftFor, setDraftFor] = useState<number | null>(null);

  if (admin && draftFor !== admin.id) {
    setDraftFor(admin.id);
    setDraft(normalizeAdminPermissions(admin.permissions));
  }

  const save = () => {
    if (!admin) return;
    updatePermissions.mutate(
      { adminId: admin.id, permissions: draft },
      {
        onSuccess: () => {
          toast.success(`Access updated for ${admin.fullName}`);
          onOpenChange(false);
        },
        onError: (error) =>
          toast.error(error instanceof Error ? error.message : "Failed to update access"),
      }
    );
  };

  return (
    <Dialog
      open={admin !== null}
      onOpenChange={(open) => {
        if (!open) setDraftFor(null);
        onOpenChange(open);
      }}
    >
      <ConsoleDialogContent size="lg">
        <ConsoleDialogHeader
          title={admin ? `Access for ${admin.fullName}` : "Access"}
          description="Ticked sections show in their sidebar and work through the AI connector. Changes apply on their next click."
          icon={<KeyRound size={18} />}
        />
        <ConsoleDialogBody>
          <AdminAccessChecklist value={draft} onChange={setDraft} disabled={updatePermissions.isPending} />
        </ConsoleDialogBody>
        <ConsoleDialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={save} disabled={updatePermissions.isPending}>
            Save access
          </Button>
        </ConsoleDialogFooter>
      </ConsoleDialogContent>
    </Dialog>
  );
};

const accessSummary = (permissions: readonly string[]) => {
  const count = normalizeAdminPermissions(permissions).length;
  if (count === 0) return "No access";
  if (count === ADMIN_MODULE_KEYS.length) return "All sections";
  return `${count} of ${ADMIN_MODULE_KEYS.length} sections`;
};

/* Shared by the loading and loaded tables so the columns do not jump. */
const TableColumns = () => (
  <colgroup>
    <col />
    <col className={styles.colRole} />
    <col className={styles.colAccess} />
    <col className={styles.colDate} />
    <col className={styles.colActions} />
  </colgroup>
);

const StackSkeleton = ({ top, bottom }: { top: string; bottom: string }) => (
  <div className={styles.stack}>
    <Skeleton style={{ height: "0.875rem", width: top }} />
    <Skeleton style={{ height: "0.75rem", width: bottom }} />
  </div>
);

const AdminRowSkeleton = () => (
  <tr>
    <td><StackSkeleton top="45%" bottom="65%" /></td>
    <td><Skeleton style={{ height: "1.125rem", width: "4rem" }} /></td>
    <td><Skeleton style={{ height: "0.875rem", width: "5.5rem" }} /></td>
    <td><StackSkeleton top="4.5rem" bottom="3rem" /></td>
    <td><Skeleton style={{ height: "1.5rem", width: "1.5rem", marginLeft: "auto" }} /></td>
  </tr>
);

const AdminCardSkeleton = () => (
  <div className={styles.card}>
    <div className={styles.cardHeader}>
      <StackSkeleton top="9rem" bottom="12rem" />
      <Skeleton style={{ height: "2rem", width: "2rem", flexShrink: 0 }} />
    </div>
    <div className={styles.cardStats}>
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} style={{ height: "2rem", width: "100%" }} />
      ))}
    </div>
  </div>
);

const formatLoginDate = (date: Date | null) =>
  date ? new Date(date).toLocaleDateString() : "Never";

const formatLoginTime = (date: Date | null) =>
  date ? new Date(date).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : null;

type AdminSortKey = "admin" | "role" | "access" | "lastLogin";

const SORT_ACCESSORS: SortAccessors<AdminListItem, AdminSortKey> = {
  admin: (a) => a.fullName,
  role: (a) => a.role,
  access: (a) => normalizeAdminPermissions(a.permissions).length,
  lastLogin: (a) => (a.lastLoginAt ? new Date(a.lastLoginAt) : null),
};

export const AdminManagementSection = () => {
  const { authState } = useAdminAuth();
  const { data, isLoading } = useAdminsList();
  const updateRole = useUpdateAdminRole();
  const deactivateAdmin = useDeactivateAdmin();
  const [createOpen, setCreateOpen] = useState(false);
  const [accessFor, setAccessFor] = useState<AdminListItem | null>(null);
  const { sorted: admins, ...sort } = useTableSort(data?.admins, SORT_ACCESSORS);

  const handleUpdateRole = (adminId: number, role: AdminRole) => {
    updateRole.mutate(
      { adminId, role },
      {
        onSuccess: () => toast.success("Role updated"),
        onError: (err) =>
          toast.error(
            err instanceof Error ? err.message : "Failed to update role"
          ),
      }
    );
  };

  const handleToggleStatus = (adminId: number, isActive: boolean) => {
    deactivateAdmin.mutate(
      { adminId, isActive: !isActive },
      {
        onSuccess: () => toast.success("Status updated"),
        onError: (err) =>
          toast.error(
            err instanceof Error ? err.message : "Failed to update status"
          ),
      }
    );
  };

  const currentUser =
    authState.type === "authenticated" ? authState.admin : null;

  const renderIdentity = (admin: AdminListItem) => (
    <div className={styles.stack}>
      <span className={styles.primaryLine}>
        <span className={styles.truncate} title={admin.fullName}>{admin.fullName}</span>
        {!admin.isActive && (
          <Badge variant="outline" className={styles.flag}>Inactive</Badge>
        )}
      </span>
      <span className={styles.secondaryLine} title={admin.email}>{admin.email}</span>
    </div>
  );

  const renderRole = (admin: AdminListItem) => (
    <Badge
      variant={admin.role === "super_admin" ? "default" : "outline"}
      className={styles.flag}
    >
      {admin.role}
    </Badge>
  );

  const renderAccess = (admin: AdminListItem) => {
    const summary = accessSummary(admin.permissions);
    return (
      <span className={summary === "No access" ? styles.emptyLine : styles.valueLine}>{summary}</span>
    );
  };

  const renderActions = (admin: AdminListItem) => {
    const isSelf = currentUser?.id === admin.id;
    return (
      <div className={styles.rowActions}>
        {/* Non-modal so the menu leaves no pointer lock behind on the page. */}
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-md"
              className={styles.iconButton}
              disabled={isSelf}
              aria-label={`Actions for ${admin.fullName}`}
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem className={styles.menuItem} onClick={() => setAccessFor(admin)}>
              Edit access
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className={styles.menuItem}>
                Change role
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup
                  value={admin.role}
                  onValueChange={(val) =>
                    handleUpdateRole(admin.id, val as AdminRole)
                  }
                >
                  {AdminRoleArrayValues.map((role) => (
                    <DropdownMenuRadioItem
                      key={role}
                      value={role}
                    >
                      {role}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className={`${styles.menuItem} ${admin.isActive ? styles.menuItemDanger : ""}`}
              onClick={() =>
                handleToggleStatus(admin.id, !!admin.isActive)
              }
            >
              {admin.isActive ? "Deactivate" : "Activate"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <TableColumns />
              <tbody>
                {Array.from({ length: 4 }).map((_, i) => <AdminRowSkeleton key={i} />)}
              </tbody>
            </table>
          </div>
          <div className={styles.cardsContainer}>
            {Array.from({ length: 2 }).map((_, i) => <AdminCardSkeleton key={i} />)}
          </div>
        </>
      );
    }

    return (
      <>
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <TableColumns />
            <thead>
              <tr>
                <SortableTh column="admin" sort={sort}>Admin</SortableTh>
                <SortableTh column="role" sort={sort}>Role</SortableTh>
                <SortableTh column="access" sort={sort}>Access</SortableTh>
                <SortableTh column="lastLogin" sort={sort}>Last login</SortableTh>
                <th><span className={styles.srOnly}>Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {admins.map((admin) => (
                <tr key={admin.id}>
                  <td>{renderIdentity(admin)}</td>
                  <td>{renderRole(admin)}</td>
                  <td>{renderAccess(admin)}</td>
                  <td>
                    <div className={styles.stack}>
                      <span className={admin.lastLoginAt ? styles.valueLine : styles.emptyLine}>
                        {formatLoginDate(admin.lastLoginAt)}
                      </span>
                      {admin.lastLoginAt && (
                        <span className={styles.secondaryLine}>{formatLoginTime(admin.lastLoginAt)}</span>
                      )}
                    </div>
                  </td>
                  <td>{renderActions(admin)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={styles.cardsContainer}>
          {admins.map((admin) => (
            <article key={admin.id} className={styles.card}>
              <div className={styles.cardHeader}>
                {renderIdentity(admin)}
                {renderActions(admin)}
              </div>
              <dl className={styles.cardStats}>
                <div className={styles.cardStat}>
                  <dt>Role</dt>
                  <dd>{renderRole(admin)}</dd>
                </div>
                <div className={styles.cardStat}>
                  <dt>Access</dt>
                  <dd>{renderAccess(admin)}</dd>
                </div>
                <div className={styles.cardStat}>
                  <dt>Last login</dt>
                  <dd className={admin.lastLoginAt ? undefined : styles.emptyLine}>
                    {admin.lastLoginAt
                      ? `${formatLoginDate(admin.lastLoginAt)}, ${formatLoginTime(admin.lastLoginAt)}`
                      : "Never"}
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </>
    );
  };

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionHeading}>
          <span className={styles.sectionIcon} aria-hidden="true">
            <Shield size={18} />
          </span>
          <h2 className={styles.sectionTitle}>Administrators</h2>
        </div>
        <Button onClick={() => setCreateOpen(true)} size="sm">
          <UserPlus size={16} /> Create admin
        </Button>
      </div>
      <div className={styles.results}>{renderContent()}</div>
      <CreateAdminDialog open={createOpen} onOpenChange={setCreateOpen} />
      <EditAccessDialog admin={accessFor} onOpenChange={(open) => !open && setAccessFor(null)} />
    </section>
  );
};
