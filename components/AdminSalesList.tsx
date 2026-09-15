import React, { useState } from "react";
import { toast } from "sonner";
import {
  SalesContactView,
  OutputType as SalesContactsOutput,
} from "../endpoints/admin/sales/contacts_GET.schema";
import { OutputType as SalesTeamOutput } from "../endpoints/admin/sales/team_GET.schema";
import { formatDemoCallSlot } from "../endpoints/demo-request/submit_POST.schema";
import { useUpdateSalesContactMutation } from "../helpers/useAdminSalesContacts";
import { SalesStage } from "../helpers/schema";
import { Button } from "./Button";
import { Badge } from "./Badge";
import { Skeleton } from "./Skeleton";
import { Checkbox } from "./Checkbox";
import { DatePicker } from "./DatePicker";
import { Popover, PopoverContent, PopoverTrigger } from "./Popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "./Tooltip";
import { ConsoleListEmpty } from "./ConsoleListEmpty";
import { SalesContactPanel } from "./SalesContactPanel";
import {
  UserX,
  AlertCircle,
  Eye,
  MessageSquare,
  Calendar as CalendarIcon,
  Phone,
  MessageCircle,
} from "lucide-react";
import {
  STAGE_OPTIONS,
  getStageColor,
  getFollowUpStatus,
  formatRelativeTime,
  getContactUrgency
} from "../helpers/adminSalesUtils";
import styles from "./AdminSalesList.module.css";

/* Shared by the loading and loaded tables so the columns do not jump. */
const TableColumns = () => (
  <colgroup>
    <col className={styles.colSelect} />
    <col />
    <col className={styles.colPhone} />
    <col className={styles.colStage} />
    <col className={styles.colFollowUp} />
    <col className={styles.colLastCalled} />
    <col className={styles.colActions} />
  </colgroup>
);

const StackSkeleton = ({ top, bottom }: { top: string; bottom: string }) => (
  <div className={styles.stack}>
    <Skeleton style={{ height: "0.875rem", width: top }} />
    <Skeleton style={{ height: "0.75rem", width: bottom }} />
  </div>
);

const ContactRowSkeleton = () => (
  <tr>
    <td className={styles.checkboxCell}><Skeleton style={{ height: "1.25rem", width: "1.25rem" }} /></td>
    <td><StackSkeleton top="55%" bottom="80%" /></td>
    <td><Skeleton style={{ height: "0.875rem", width: "5.25rem" }} /></td>
    <td><Skeleton style={{ height: "1.125rem", width: "4.5rem" }} /></td>
    <td><StackSkeleton top="7rem" bottom="70%" /></td>
    <td><StackSkeleton top="3rem" bottom="80%" /></td>
    <td><Skeleton style={{ height: "1.5rem", width: "5.5rem", marginLeft: "auto" }} /></td>
  </tr>
);

const ContactCardSkeleton = () => (
  <div className={styles.card}>
    <div className={styles.cardHeader}>
      <div className={styles.stack}>
        <Skeleton style={{ height: "1rem", width: "9rem", maxWidth: "100%" }} />
        <Skeleton style={{ height: "0.75rem", width: "12rem", maxWidth: "100%" }} />
      </div>
      <Skeleton style={{ height: "2rem", width: "6rem", flexShrink: 0 }} />
    </div>
    <div className={styles.cardStats}>
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} style={{ height: "2rem", width: "100%" }} />
      ))}
    </div>
  </div>
);

type AdminSalesListProps = {
  data: SalesContactsOutput | undefined;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
  teamData: SalesTeamOutput | undefined;
  selectedContactIds: Set<number>;
  toggleContactSelection: (id: number) => void;
  toggleAllSelection: () => void;
  setSelectedContact: (contact: SalesContactView) => void;
  searchTerm: string;
};

export const AdminSalesList: React.FC<AdminSalesListProps> = ({
  data,
  isFetching,
  isError,
  error,
  teamData,
  selectedContactIds,
  toggleContactSelection,
  toggleAllSelection,
  setSelectedContact,
  searchTerm,
}) => {
  const [openPanelContactId, setOpenPanelContactId] = useState<number | null>(null);
  const [panelAction, setPanelAction] = useState<'log_call' | undefined>(undefined);

  const updateMutation = useUpdateSalesContactMutation();

  const handleStageChange = (contactId: number, newStage: SalesStage) => {
    updateMutation.mutate({ contactId, stage: newStage }, {
      onSuccess: () => {
        toast.success("Stage updated successfully");
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : "Failed to update stage");
      }
    });
  };

  const handleFollowUpChange = (contactId: number, date?: Date) => {
    updateMutation.mutate({ contactId, followUpDate: date ? date.toISOString() : null }, {
      onSuccess: () => {
        toast.success("Follow-up date updated successfully");
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : "Failed to update follow-up date");
      }
    });
  };

  const openPanel = (contactId: number, action?: 'log_call') => {
    setOpenPanelContactId(contactId);
    setPanelAction(action);
  };

  const closePanel = () => {
    setOpenPanelContactId(null);
    setPanelAction(undefined);
  };

  const truncate = (str: string, max: number) => str.length > max ? str.substring(0, max) + '...' : str;

  /* The column header and the card label already say "Follow-up", so the button shows only the date. */
  const renderFollowUpBadge = (contact: SalesContactView) => {
    const { label, status } = getFollowUpStatus(contact.followUpDate);
    const current = contact.followUpDate ? label : 'None';

    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={`${styles.followUpBtn} ${styles[`followUp_${status}`]}`}
            aria-label={`Change follow-up date for ${contact.displayName}, currently ${current}`}
          >
            <CalendarIcon size={12} className={styles.calendarIcon} />
            <span className={styles.truncate}>{current}</span>
            {status === "overdue" && <Badge variant="destructive" className={styles.microBadge}>!</Badge>}
          </button>
        </PopoverTrigger>
        <PopoverContent className={styles.datePickerPopover} align="start" removeBackgroundAndPadding>
          <div style={{ padding: "var(--spacing-2)", display: "flex", flexDirection: "column", gap: "var(--spacing-2)" }}>
            <DatePicker 
              value={contact.followUpDate ? new Date(contact.followUpDate) : undefined}
              onChange={(d) => handleFollowUpChange(contact.id, d)}
              showTime={true}
            />
            {contact.followUpDate && (
               <Button 
                 variant="ghost" 
                 size="sm" 
                 onClick={() => handleFollowUpChange(contact.id, undefined)}
                 className={styles.clearDateBtn}
               >
                 Clear Date
               </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  const renderStage = (contact: SalesContactView) => {
    const label = STAGE_OPTIONS.find(o => o.value === contact.stage)?.label || contact.stage;
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={styles.stageBadgeTrigger}
            aria-label={`Change stage for ${contact.displayName}, currently ${label}`}
          >
            <Badge variant={getStageColor(contact.stage)} className={styles.flag}>{label}</Badge>
          </button>
        </PopoverTrigger>
        <PopoverContent className={styles.stagePopoverContent} align="start">
          {STAGE_OPTIONS.map(opt => (
            <div 
              key={opt.value} 
              className={styles.stageOption} 
              onClick={() => handleStageChange(contact.id, opt.value)}
            >
              <Badge variant={getStageColor(opt.value)} className={styles.fullWidthBadge}>{opt.label}</Badge>
            </div>
          ))}
        </PopoverContent>
      </Popover>
    );
  };

  const renderPhone = (contact: SalesContactView) =>
    contact.mobileNumber ? (
      <div className={styles.phoneLine}>
        <a href={`tel:+91${contact.mobileNumber}`} className={styles.phoneLink}>{contact.mobileNumber}</a>
        <Tooltip>
          <TooltipTrigger asChild>
            <a
              href={`https://wa.me/91${contact.mobileNumber}`}
              target="_blank"
              rel="noreferrer"
              className={`${styles.iconLink} ${styles.waLink}`}
              aria-label={`Message ${contact.displayName} on WhatsApp`}
            >
              <MessageCircle />
            </a>
          </TooltipTrigger>
          <TooltipContent>WhatsApp</TooltipContent>
        </Tooltip>
      </div>
    ) : (
      <span className={styles.emptyLine}>N/A</span>
    );

  const renderIdentity = (contact: SalesContactView) => (
    <span className={styles.primaryLine}>
      <span className={styles.truncate} title={contact.displayName}>{contact.displayName}</span>
      {contact.source === "demo_request" && (
        <Badge variant="warning" className={styles.flag}>Demo</Badge>
      )}
    </span>
  );

  const renderMeta = (contact: SalesContactView) => {
    const academy = contact.leadExpertise || contact.academyName || "No academy";
    const assignment = contact.assignedToAdminName ? `Assigned to: ${contact.assignedToAdminName}` : "Unassigned";
    return (
      <span className={styles.secondaryLine} title={`${academy} • ${assignment}`}>
        {academy} &bull;{" "}
        {contact.assignedToAdminName ? assignment : <span className={styles.mutedItalic}>Unassigned</span>}
      </span>
    );
  };

  const renderLastCalled = (contact: SalesContactView) =>
    contact.lastContactedAt ? (
      <span className={styles.valueLine}>{formatRelativeTime(contact.lastContactedAt)}</span>
    ) : (
      <span className={styles.emptyLine}>Never</span>
    );

  const renderActions = (contact: SalesContactView) => {
    const noteCount = contact.notes?.length || 0;
    return (
      <div className={styles.rowActions}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-md"
              className={styles.iconButton}
              aria-label={`Log call with ${contact.displayName}`}
              onClick={() => openPanel(contact.id, 'log_call')}
            >
              <Phone />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Log call</TooltipContent>
        </Tooltip>
        {contact.userId !== null && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-md"
                className={styles.iconButton}
                aria-label={`View profile of ${contact.displayName}`}
                onClick={() => setSelectedContact(contact)}
              >
                <Eye />
              </Button>
            </TooltipTrigger>
            <TooltipContent>View profile</TooltipContent>
          </Tooltip>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-md"
              className={styles.iconButton}
              aria-label={`Notes for ${contact.displayName} (${noteCount})`}
              onClick={() => openPanel(contact.id)}
            >
              <span className={styles.noteIcon}>
                <MessageSquare />
                {noteCount > 0 && <span className={styles.noteIndicator} />}
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Notes ({noteCount})</TooltipContent>
        </Tooltip>
      </div>
    );
  };

  const renderContent = () => {
    if (isFetching && !data) {
      return (
        <>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <TableColumns />
              <tbody>
                {Array.from({ length: 10 }).map((_, i) => <ContactRowSkeleton key={i} />)}
              </tbody>
            </table>
          </div>
          <div className={styles.cardsContainer}>
            {Array.from({ length: 4 }).map((_, i) => <ContactCardSkeleton key={i} />)}
          </div>
        </>
      );
    }

    if (isError) {
      return (
        <ConsoleListEmpty
          tone="error"
          icon={<AlertCircle size={24} />}
          title="Error loading contacts"
          description={error instanceof Error ? error.message : "An unexpected error occurred."}
        />
      );
    }

    if (!data || data.contacts.length === 0) {
      return (
        <ConsoleListEmpty
          icon={<UserX size={24} />}
          title="No contacts found"
          description={searchTerm ? `No contacts match your search for "${searchTerm}".` : "There are no contacts in the pipeline yet."}
        />
      );
    }

    const allSelected = selectedContactIds.size > 0 && selectedContactIds.size === data.contacts.length;
    const isIndeterminate = selectedContactIds.size > 0 && selectedContactIds.size < data.contacts.length;

    return (
      <>
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <TableColumns />
            <thead>
              <tr>
                <th className={styles.checkboxCell}>
                  <Checkbox 
                    checked={allSelected} 
                    onChange={toggleAllSelection} 
                    aria-label="Select all contacts"
                    ref={input => {
                      if (input) input.indeterminate = isIndeterminate;
                    }}
                  />
                </th>
                <th>Contact</th>
                <th>Phone</th>
                <th>Stage</th>
                <th>Follow-up</th>
                <th>Last called</th>
                <th><span className={styles.srOnly}>Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {data.contacts.map((contact: SalesContactView) => {
                const urgency = getContactUrgency(contact);
                const lastNote = contact.notes?.[0];
                const askedFor = contact.preferredCallDate && contact.preferredCallSlot
                  ? `Lead asked for: ${formatDemoCallSlot(contact.preferredCallDate, contact.preferredCallSlot)}`
                  : null;

                return (
                  <tr key={contact.id}>
                    <td className={`${styles.checkboxCell} ${styles[`urgency_${urgency}`]}`}>
                      <Checkbox 
                        checked={selectedContactIds.has(contact.id)}
                        onChange={() => toggleContactSelection(contact.id)}
                        aria-label={`Select ${contact.displayName}`}
                      />
                    </td>
                    <td>
                      <div className={styles.stack}>
                        {renderIdentity(contact)}
                        {renderMeta(contact)}
                      </div>
                    </td>
                    <td>{renderPhone(contact)}</td>
                    <td>{renderStage(contact)}</td>
                    <td>
                      <div className={styles.stack}>
                        {renderFollowUpBadge(contact)}
                        {askedFor && (
                          <span className={styles.secondaryLine} title={askedFor}>{askedFor}</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className={styles.stack}>
                        {renderLastCalled(contact)}
                        {lastNote && (
                          <span className={styles.secondaryLine} title={`${lastNote.createdBy}: ${lastNote.note}`}>
                            <span className={styles.noteAuthor}>{lastNote.createdBy}:</span> {lastNote.note}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>{renderActions(contact)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className={styles.cardsContainer}>
          {data.contacts.map((contact: SalesContactView) => {
            const urgency = getContactUrgency(contact);
            const lastNote = contact.notes?.[0];

            return (
              <article key={contact.id} className={`${styles.card} ${styles[`urgency_${urgency}`]}`}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardIdentity}>
                    <Checkbox 
                      checked={selectedContactIds.has(contact.id)}
                      onChange={() => toggleContactSelection(contact.id)}
                      aria-label={`Select ${contact.displayName}`}
                    />
                    <div className={styles.stack}>
                      {renderIdentity(contact)}
                      {renderMeta(contact)}
                    </div>
                  </div>
                  {renderActions(contact)}
                </div>
                {lastNote && (
                  <p className={styles.cardNote}>
                    <span className={styles.noteAuthor}>{lastNote.createdBy}:</span> {truncate(lastNote.note, 60)}
                  </p>
                )}
                <dl className={styles.cardStats}>
                  <div className={styles.cardStat}><dt>Phone</dt><dd>{renderPhone(contact)}</dd></div>
                  <div className={styles.cardStat}><dt>Stage</dt><dd>{renderStage(contact)}</dd></div>
                  <div className={styles.cardStat}><dt>Follow-up</dt><dd>{renderFollowUpBadge(contact)}</dd></div>
                  <div className={styles.cardStat}><dt>Last called</dt><dd>{renderLastCalled(contact)}</dd></div>
                  {contact.preferredCallDate && contact.preferredCallSlot && (
                    <div className={styles.cardStat}>
                      <dt>Lead asked for</dt>
                      <dd>{formatDemoCallSlot(contact.preferredCallDate, contact.preferredCallSlot)}</dd>
                    </div>
                  )}
                </dl>
              </article>
            );
          })}
        </div>
      </>
    );
  };

  const hasContacts = !isError && !!data && data.contacts.length > 0;

  return (
    <>
      <div className={styles.results}>{renderContent()}</div>

      {/* Outside .results: the panel is position: fixed and must not sit inside a container. */}
      {hasContacts && (
        <SalesContactPanel 
          contactId={openPanelContactId}
          onClose={closePanel}
          teamData={teamData}
          initialAction={panelAction}
        />
      )}
    </>
  );
};
