import React, { useState } from "react";
import { Check, ChevronsUpDown, Plus, Trash2, UserPlus, Users } from "lucide-react";
import type { AdminOption } from "../endpoints/admin/admins/options_GET.schema";
import { MAX_MASTERCLASS_CO_HOSTS, MasterclassCoHostType } from "../helpers/masterclassCoHosts";
import { hostInitials } from "../helpers/masterclassDisplay";
import { Button } from "./Button";
import { Input } from "./Input";
import { ImageUploader } from "./ImageUploader";
import { Popover, PopoverContent, PopoverTrigger } from "./Popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "./Command";
import styles from "./MasterclassPresentersFields.module.css";

/** A co-host row being edited. `uid` keys the row in the list and is never sent. */
export type CoHostDraft = {
  uid: number;
  type: MasterclassCoHostType;
  userId: number | null;
  name: string;
  title: string;
  profileImage: string;
  imageFileId: string;
  organization: string;
  website: string;
};

let coHostUid = 0;
export const newCoHostDraft = (values: Partial<Omit<CoHostDraft, "uid">> & { type: MasterclassCoHostType }): CoHostDraft => ({
  uid: ++coHostUid,
  userId: null,
  name: "",
  title: "",
  profileImage: "",
  imageFileId: "",
  organization: "",
  website: "",
  ...values,
});

const PersonAvatar = ({ name, imageUrl, size = "md" }: { name: string; imageUrl: string | null; size?: "sm" | "md" }) =>
  imageUrl ? (
    <img src={imageUrl} alt="" className={`${styles.avatar} ${styles[`avatar_${size}`]}`} />
  ) : (
    <span className={`${styles.avatar} ${styles[`avatar_${size}`]}`} aria-hidden="true">
      {hostInitials(name)}
    </span>
  );

interface AdminPickerProps {
  admins: AdminOption[];
  /** Admins that cannot be picked here (the host, co-hosts already chosen). */
  excludeIds?: number[];
  onSelect: (admin: AdminOption) => void;
  children: React.ReactNode;
  disabled?: boolean;
}

/**
 * Searchable list of active admin accounts in a popover, opened by whatever
 * trigger is passed as children. Teachers and students are never listed.
 */
export const AdminPicker: React.FC<AdminPickerProps> = ({ admins, excludeIds = [], onSelect, children, disabled }) => {
  const [open, setOpen] = useState(false);
  const options = admins.filter((admin) => admin.isActive && !excludeIds.includes(admin.id));
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        {children}
      </PopoverTrigger>
      <PopoverContent removeBackgroundAndPadding align="start" className={styles.pickerPopover}>
        <Command>
          <CommandInput placeholder="Search admins..." autoFocus />
          <CommandList>
            <CommandEmpty>No admins found.</CommandEmpty>
            <CommandGroup>
              {options.map((admin) => (
                <CommandItem
                  key={admin.id}
                  value={`${admin.fullName} ${admin.id}`}
                  onSelect={() => {
                    onSelect(admin);
                    setOpen(false);
                  }}
                >
                  <PersonAvatar name={admin.fullName} imageUrl={admin.avatarUrl} size="sm" />
                  <span className={styles.optionName}>{admin.fullName}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

interface HostPickerProps {
  admins: AdminOption[];
  hostAdminId: number | null;
  /** Shown while the admin list loads, or when the host is not in it. */
  fallbackName: string;
  isLoading: boolean;
  onChange: (adminId: number) => void;
}

export const HostPicker: React.FC<HostPickerProps> = ({ admins, hostAdminId, fallbackName, isLoading, onChange }) => {
  const selected = admins.find((admin) => admin.id === hostAdminId);
  const name = selected?.fullName ?? fallbackName;
  return (
    <AdminPicker admins={admins} onSelect={(admin) => onChange(admin.id)} disabled={isLoading}>
      <button type="button" className={styles.hostTrigger} aria-label="Choose the host">
        {name ? (
          <>
            <PersonAvatar name={name} imageUrl={selected?.avatarUrl ?? null} size="sm" />
            <span className={styles.hostTriggerName}>{name}</span>
          </>
        ) : (
          <span className={styles.hostTriggerPlaceholder}>{isLoading ? "Loading admins..." : "Choose an admin"}</span>
        )}
        <ChevronsUpDown size={16} aria-hidden="true" className={styles.hostTriggerIcon} />
      </button>
    </AdminPicker>
  );
};

interface CoHostsEditorProps {
  admins: AdminOption[];
  hostAdminId: number | null;
  value: CoHostDraft[];
  onChange: (next: CoHostDraft[]) => void;
}

export const CoHostsEditor: React.FC<CoHostsEditorProps> = ({ admins, hostAdminId, value, onChange }) => {
  const atLimit = value.length >= MAX_MASTERCLASS_CO_HOSTS;
  const takenIds = [
    ...(hostAdminId ? [hostAdminId] : []),
    ...value.flatMap((coHost) => (coHost.type === "admin" && coHost.userId ? [coHost.userId] : [])),
  ];
  const update = (uid: number, patch: Partial<Omit<CoHostDraft, "uid">>) =>
    onChange(value.map((coHost) => (coHost.uid === uid ? { ...coHost, ...patch } : coHost)));
  const remove = (uid: number) => onChange(value.filter((coHost) => coHost.uid !== uid));

  return (
    <section className={styles.coHosts} aria-labelledby="mc-cohosts-title">
      <div className={styles.coHostsHead}>
        <div>
          <p id="mc-cohosts-title" className={styles.coHostsTitle}>
            Co-hosts (optional)
          </p>
          <p className={styles.coHostsHint}>Shown beside the host on the masterclass page.</p>
        </div>
        <div className={styles.coHostsActions}>
          <AdminPicker
            admins={admins}
            excludeIds={takenIds}
            disabled={atLimit}
            onSelect={(admin) =>
              onChange([
                ...value,
                newCoHostDraft({ type: "admin", userId: admin.id, name: admin.fullName, profileImage: admin.avatarUrl ?? "" }),
              ])
            }
          >
            <Button type="button" variant="outline" size="sm" className={styles.actionButton} disabled={atLimit}>
              <Users size={14} /> Select from admins
            </Button>
          </AdminPicker>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={styles.actionButton}
            disabled={atLimit}
            onClick={() => onChange([...value, newCoHostDraft({ type: "guest" })])}
          >
            <UserPlus size={14} /> Add guest
          </Button>
        </div>
      </div>

      {value.length > 0 && (
        <ul className={styles.list}>
          {value.map((coHost, index) => {
            const live = coHost.type === "admin" ? admins.find((admin) => admin.id === coHost.userId) : undefined;
            const label = `Co-host ${index + 1}`;
            return (
              <li key={coHost.uid} className={styles.row}>
                {coHost.type === "admin" ? (
                  <>
                    <PersonAvatar name={live?.fullName ?? coHost.name} imageUrl={live?.avatarUrl ?? (coHost.profileImage || null)} />
                    <div className={styles.rowBody}>
                      <div className={styles.rowIdentity}>
                        <span className={styles.rowName}>{live?.fullName ?? coHost.name}</span>
                        <span className={`${styles.chip} ${styles.chipMember}`}>
                          <Check size={12} aria-hidden="true" /> Testkart member
                        </span>
                      </div>
                      <Input
                        value={coHost.title}
                        onChange={(e) => update(coHost.uid, { title: e.target.value })}
                        placeholder="Designation, e.g. Faculty, Testkart"
                        aria-label={`${label} designation`}
                        maxLength={80}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className={styles.photo}>
                      <ImageUploader
                        folder="masterclass-cohosts"
                        label="Photo"
                        aspectRatio="1 / 1"
                        maxSizeInMB={2}
                        currentImageUrl={coHost.profileImage || undefined}
                        currentFileId={coHost.imageFileId || undefined}
                        onSuccess={(result) => update(coHost.uid, { profileImage: result.url, imageFileId: result.fileId })}
                      />
                    </div>
                    <div className={styles.rowBody}>
                      <div className={styles.rowIdentity}>
                        <span className={`${styles.chip} ${styles.chipGuest}`}>Guest</span>
                      </div>
                      <div className={styles.guestGrid}>
                        <Input
                          value={coHost.name}
                          onChange={(e) => update(coHost.uid, { name: e.target.value })}
                          placeholder="Full name *"
                          aria-label={`${label} full name`}
                          maxLength={80}
                        />
                        <Input
                          value={coHost.title}
                          onChange={(e) => update(coHost.uid, { title: e.target.value })}
                          placeholder="Designation"
                          aria-label={`${label} designation`}
                          maxLength={80}
                        />
                        <Input
                          value={coHost.organization}
                          onChange={(e) => update(coHost.uid, { organization: e.target.value })}
                          placeholder="Organization"
                          aria-label={`${label} organization`}
                          maxLength={120}
                        />
                        <Input
                          value={coHost.website}
                          onChange={(e) => update(coHost.uid, { website: e.target.value })}
                          placeholder="Website or social profile URL"
                          aria-label={`${label} website`}
                          inputMode="url"
                          maxLength={300}
                        />
                      </div>
                    </div>
                  </>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-md"
                  className={styles.remove}
                  aria-label={`Remove ${label}`}
                  onClick={() => remove(coHost.uid)}
                >
                  <Trash2 />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {value.length === 0 && (
        <p className={styles.empty}>
          <Plus size={14} aria-hidden="true" /> Add admins from your team or outside guests.
        </p>
      )}
    </section>
  );
};