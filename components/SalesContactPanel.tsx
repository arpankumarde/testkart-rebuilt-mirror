import React, { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAdminSalesContactDetail } from "../helpers/useAdminSalesContactDetail";
import { ContactDetailNote, ContactDetailActivity } from "../endpoints/admin/sales/contacts/detail_GET.schema";
import { formatDemoCallSlot } from "../endpoints/demo-request/submit_POST.schema";
import { OutputType as SalesTeamOutput } from "../endpoints/admin/sales/team_GET.schema";
import { useUpdateSalesContactMutation } from "../helpers/useAdminSalesContacts";
import { SalesStage, CallDisposition } from "../helpers/schema";
import { Button } from "./Button";
import { Badge } from "./Badge";
import { Skeleton } from "./Skeleton";
import { Textarea } from "./Textarea";
import { DatePicker } from "./DatePicker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./Select";
import {
  MessageSquare,
  Send,
  Calendar as CalendarIcon,
  Phone,
  MessageCircle,
  X,
  User,
  Activity,
  FileText,
  BookOpen,
  Briefcase
} from "lucide-react";
import {
  STAGE_OPTIONS,
  DISPOSITION_OPTIONS,
  getStageColor,
  getDispositionColor,
  getDispositionLabel,
  formatDate,
  formatRelativeTime
} from "../helpers/adminSalesUtils";
import styles from "./SalesContactPanel.module.css";

type SalesContactPanelProps = {
  contactId: number | null;
  onClose: () => void;
  teamData: SalesTeamOutput | undefined;
  initialAction?: 'log_call';
};

type TimelineEntry =
  | { type: 'call_logged'; date: Date | null; id: string; data: ContactDetailNote }
  | { type: 'note_added'; date: Date | null; id: string; data: ContactDetailNote }
  | { type: 'activity'; date: Date | null; id: string; data: ContactDetailActivity };

const renderArrayBadges = (val: unknown) => {
  if (!val) return <span className={styles.mutedItalic}>None</span>;
  let arr: string[] = [];
  if (Array.isArray(val)) {
    arr = val.map(String);
  } else if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) arr = parsed.map(String);
    } catch(e) {}
  }
  if (arr.length === 0) return <span className={styles.mutedItalic}>None</span>;
  return (
    <div className={styles.badgeGroup}>
      {arr.map((item, idx) => (
        <Badge key={idx} variant="secondary" className={styles.infoBadge}>{item}</Badge>
      ))}
    </div>
  );
};

export const SalesContactPanel: React.FC<SalesContactPanelProps> = ({
  contactId,
  onClose,
  teamData,
  initialAction,
}) => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'info'>('overview');
  const [newNote, setNewNote] = useState<string>("");
  const [newDisposition, setNewDisposition] = useState<CallDisposition | "__empty">("__empty");

  const { data: detailData, isFetching: detailLoading } = useAdminSalesContactDetail(contactId ?? undefined);
  const updateMutation = useUpdateSalesContactMutation();

  useEffect(() => {
    if (contactId) {
      setActiveTab('overview');
      setNewNote("");
      if (initialAction === 'log_call') {
        setNewDisposition("connected_interested");
      } else {
        setNewDisposition("__empty");
      }
    }
  }, [contactId, initialAction]);

  const invalidateDetail = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "sales", "contacts", "detail"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "sales", "contacts"] });
  };

  const handleStageChange = (id: number, newStage: SalesStage) => {
    updateMutation.mutate({ contactId: id, stage: newStage }, {
      onSuccess: () => {
        toast.success("Stage updated successfully");
        invalidateDetail();
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : "Failed to update stage");
      }
    });
  };

  const handleAssignToChange = (id: number, adminIdStr: string) => {
    const assignedToAdminId = adminIdStr === "__unassigned" ? null : parseInt(adminIdStr, 10);
    updateMutation.mutate({ contactId: id, assignedToAdminId }, {
      onSuccess: () => {
        toast.success("Assignment updated successfully");
        invalidateDetail();
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : "Failed to update assignment");
      }
    });
  };

  const handleFollowUpChange = (id: number, date?: Date) => {
    updateMutation.mutate({ contactId: id, followUpDate: date ? date.toISOString() : null }, {
      onSuccess: () => {
        toast.success("Follow-up date updated successfully");
        invalidateDetail();
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : "Failed to update follow-up date");
      }
    });
  };

  const handleAddNote = (id: number) => {
    const note = newNote.trim();
    if (!note) return;
    
    const disp = newDisposition;
    const disposition = disp && disp !== "__empty" ? disp : undefined;

    updateMutation.mutate({ contactId: id, note, disposition }, {
      onSuccess: () => {
        toast.success("Note added successfully");
        setNewNote("");
        setNewDisposition("__empty");
        invalidateDetail();
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : "Failed to add note");
      }
    });
  };

  if (!contactId) return null;

  const renderOverview = () => {
    if (!detailData) return null;
    const contactInfo = detailData.contact;

    return (
      <div className={styles.overviewTab}>
        <div className={styles.panelQuickActions}>
          <div className={styles.panelFormGroup}>
            <label className={styles.panelLabel}>Stage</label>
            <Select
              value={contactInfo.stage}
              onValueChange={(val) => handleStageChange(contactInfo.id, val as SalesStage)}
              disabled={updateMutation.isPending}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STAGE_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div style={{ display: 'flex' }}>
                      <Badge variant={getStageColor(opt.value)}>{opt.label}</Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className={styles.panelFormGroup}>
            <label className={styles.panelLabel}>Assigned To</label>
            <Select
              value={contactInfo.assignedToAdminId?.toString() || "__unassigned"}
              onValueChange={(val) => handleAssignToChange(contactInfo.id, val)}
              disabled={updateMutation.isPending}
            >
              <SelectTrigger>
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__unassigned">
                  <span className={styles.unassignedItem}>Unassigned</span>
                </SelectItem>
                {teamData?.team.map((member) => (
                  <SelectItem key={member.id} value={member.id.toString()}>
                    {member.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className={styles.panelFormGroup}>
          <label className={styles.panelLabel}>Follow-up Date</label>
          <DatePicker 
            value={contactInfo.followUpDate ? new Date(contactInfo.followUpDate) : undefined}
            onChange={(d) => handleFollowUpChange(contactInfo.id, d)}
            showTime={true}
          />
          {/* The slot the lead picked on the website. Sits under the follow-up
              field because the demo request seeds it, and a rep who moves the
              follow-up should still be able to see what was promised. */}
          {contactInfo.preferredCallDate && contactInfo.preferredCallSlot && (
            <p className={styles.requestedCall}>
              <CalendarIcon size={14} />
              Lead asked for {formatDemoCallSlot(contactInfo.preferredCallDate, contactInfo.preferredCallSlot)}
            </p>
          )}
        </div>

        {/* Website demo leads have no account yet, so there is no authored content to show. */}
        {contactInfo.userId !== null && (
          <div className={styles.statsGrid}>
            <div className={styles.statItem}><FileText size={16}/><span>{detailData.contentStats.testsCount}</span><small>Tests</small></div>
            <div className={styles.statItem}><BookOpen size={16}/><span>{detailData.contentStats.coursesCount}</span><small>Courses</small></div>
            <div className={styles.statItem}><Briefcase size={16}/><span>{detailData.contentStats.productsCount}</span><small>Products</small></div>
            <div className={styles.statItem}><Briefcase size={16}/><span>{detailData.contentStats.bundlesCount}</span><small>Bundles</small></div>
            <div className={styles.statItem}><Activity size={16}/><span>{detailData.contentStats.liveTestsCount}</span><small>Live Tests</small></div>
          </div>
        )}

        <div className={styles.addNoteForm}>
          <Select
            value={newDisposition}
            onValueChange={(val) => setNewDisposition(val as CallDisposition | "__empty")}
          >
            <SelectTrigger className={styles.dispositionTrigger}>
              <SelectValue placeholder="Call Disposition (Optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__empty">
                <span className={styles.unassignedItem}>No Disposition</span>
              </SelectItem>
              {DISPOSITION_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea 
            placeholder="Add a new note..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            className={styles.noteTextarea}
            rows={3}
          />
          <Button 
            onClick={() => handleAddNote(contactInfo.id)}
            disabled={!newNote.trim() || updateMutation.isPending}
            className={styles.fullWidthButton}
          >
            <Send size={16} />
            Add Note
          </Button>
        </div>
      </div>
    );
  };

  const renderTimeline = () => {
    if (!detailData) return null;
    const timeline: TimelineEntry[] = [];
    
    detailData.notes.forEach((n: ContactDetailNote) => {
      timeline.push({
        type: n.disposition ? 'call_logged' : 'note_added',
        date: n.createdAt,
        id: `note-${n.id}`,
        data: n
      });
    });
  
    // Deduplicate notes & calls from activities
    detailData.activities.forEach((a: ContactDetailActivity) => {
      if (a.activityType !== 'note_added' && a.activityType !== 'call_logged') {
        timeline.push({
          type: 'activity',
          date: a.createdAt,
          id: `act-${a.id}`,
          data: a
        });
      }
    });
  
    timeline.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  
    if (timeline.length === 0) {
      return <p className={styles.mutedItalic}>No activity recorded yet.</p>;
    }
  
    return (
      <div className={styles.timeline}>
        {timeline.map((item) => {
          let content = null;
          let icon = null;
          let createdBy = '';
          
          if (item.type === 'call_logged' || item.type === 'note_added') {
            const note = item.data;
            createdBy = note.createdBy;
            icon = item.type === 'call_logged' ? <Phone size={14} /> : <MessageSquare size={14} />;
            content = (
              <>
                <div className={styles.timelineHeader}>
                  <strong>{item.type === 'call_logged' ? `Call logged — ${getDispositionLabel(note.disposition)}` : 'Note added'}</strong>
                  <span className={styles.timelineMeta}>by {createdBy} • {formatRelativeTime(item.date)}</span>
                </div>
                {note.disposition && item.type !== 'call_logged' && (
                  <Badge variant={getDispositionColor(note.disposition)} className={styles.dispositionBadge}>
                    {getDispositionLabel(note.disposition)}
                  </Badge>
                )}
                <div className={styles.timelineText}>{note.note}</div>
              </>
            );
          } else {
            const act = item.data;
            createdBy = act.createdBy;
            let actContent: React.ReactNode = '';
            
            if (act.activityType === 'stage_changed') {
              icon = <Activity size={14} />;
              actContent = (
                <div className={styles.activityWithBadges}>
                  Changed stage from 
                  <Badge variant={getStageColor(act.oldValue as SalesStage)}>{STAGE_OPTIONS.find(o => o.value === act.oldValue)?.label || act.oldValue || 'None'}</Badge> 
                  to 
                  <Badge variant={getStageColor(act.newValue as SalesStage)}>{STAGE_OPTIONS.find(o => o.value === act.newValue)?.label || act.newValue || 'None'}</Badge>
                </div>
              );
            } else if (act.activityType === 'assignment_changed') {
              icon = <User size={14} />;
              actContent = `Reassigned from ${act.oldValue || 'Unassigned'} to ${act.newValue || 'Unassigned'}`;
            } else if (act.activityType === 'follow_up_changed') {
              icon = <CalendarIcon size={14} />;
              actContent = `Follow-up changed from ${act.oldValue ? formatDate(act.oldValue) : 'None'} to ${act.newValue ? formatDate(act.newValue) : 'Cleared'}`;
            } else {
               icon = <Activity size={14} />;
               actContent = act.details || act.activityType;
            }
  
            content = (
              <>
                <div className={styles.timelineHeader}>
                  <strong>{actContent}</strong>
                  <span className={styles.timelineMeta}>by {createdBy} • {formatRelativeTime(item.date)}</span>
                </div>
              </>
            );
          }
  
          return (
            <div key={item.id} className={styles.timelineItem}>
              <div className={styles.timelineIconWrapper}>
                <div className={styles.timelineIcon}>{icon}</div>
                <div className={styles.timelineLine} />
              </div>
              <div className={styles.timelineContent}>
                {content}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderInfo = () => {
    if (!detailData) return null;
    const contactInfo = detailData.contact;

    return (
      <div className={styles.infoContainer}>
        <div className={styles.infoSection}>
          <h4 className={styles.infoSectionTitle}>Contact Information</h4>
          <div className={styles.infoGrid}>
            <div className={styles.infoItem}><span className={styles.infoLabel}>Email</span><span className={styles.infoValue}>{contactInfo.email || '-'}</span></div>
            <div className={styles.infoItem}><span className={styles.infoLabel}>Phone</span><span className={styles.infoValue}>{contactInfo.mobileNumber || '-'}</span></div>
            <div className={styles.infoItem}><span className={styles.infoLabel}>Academy</span><span className={styles.infoValue}>{contactInfo.academyName || '-'}</span></div>
            <div className={styles.infoItem}><span className={styles.infoLabel}>Location</span><span className={styles.infoValue}>{contactInfo.location || '-'}</span></div>
            <div className={styles.infoItem}><span className={styles.infoLabel}>Lead Source</span><span className={styles.infoValue}>{contactInfo.source === 'demo_request' ? 'Website demo request' : 'Signup'}</span></div>
            {contactInfo.leadExpertise && (
              <div className={styles.infoItem}><span className={styles.infoLabel}>Expertise (stated)</span><span className={styles.infoValue}>{contactInfo.leadExpertise}</span></div>
            )}
            {contactInfo.preferredCallDate && contactInfo.preferredCallSlot && (
              <div className={styles.infoItemFull}><span className={styles.infoLabel}>Call requested for</span><span className={styles.infoValue}>{formatDemoCallSlot(contactInfo.preferredCallDate, contactInfo.preferredCallSlot)}</span></div>
            )}
          </div>
        </div>

        <div className={styles.infoSection}>
          <h4 className={styles.infoSectionTitle}>Onboarding Status</h4>
          <div className={styles.infoGrid}>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Status</span>
              <span className={styles.infoValue}>
                {contactInfo.onboardingCompleted ? <Badge variant="success">Completed</Badge> : <Badge variant="warning">Incomplete</Badge>}
              </span>
            </div>
            <div className={styles.infoItem}><span className={styles.infoLabel}>Signup Source</span><span className={styles.infoValue}>{contactInfo.signupSource || '-'}</span></div>
            <div className={styles.infoItem}><span className={styles.infoLabel}>Discovery Source</span><span className={styles.infoValue}>{contactInfo.discoverySource || '-'}</span></div>
            <div className={styles.infoItem}><span className={styles.infoLabel}>School/College</span><span className={styles.infoValue}>{contactInfo.schoolCollegeName || '-'}</span></div>
          </div>
        </div>

        <div className={styles.infoSection}>
          <h4 className={styles.infoSectionTitle}>Teaching Profile</h4>
          <div className={styles.infoGrid}>
            <div className={styles.infoItemFull}><span className={styles.infoLabel}>Teaching Categories</span><div className={styles.infoValue}>{renderArrayBadges(contactInfo.teachingCategories)}</div></div>
            <div className={styles.infoItemFull}><span className={styles.infoLabel}>Target Exams</span><div className={styles.infoValue}>{renderArrayBadges(contactInfo.targetExams)}</div></div>
            <div className={styles.infoItem}><span className={styles.infoLabel}>Experience Level</span><span className={styles.infoValue}>{contactInfo.teachingExperienceLevel || '-'}</span></div>
            <div className={styles.infoItem}><span className={styles.infoLabel}>Current Occupation</span><span className={styles.infoValue}>{contactInfo.currentOccupation || '-'}</span></div>
            <div className={styles.infoItemFull}><span className={styles.infoLabel}>Expertise Areas</span><div className={styles.infoValue}>{renderArrayBadges(contactInfo.expertiseAreas)}</div></div>
            <div className={styles.infoItemFull}><span className={styles.infoLabel}>Languages</span><div className={styles.infoValue}>{renderArrayBadges(contactInfo.languages)}</div></div>
          </div>
        </div>

        <div className={styles.infoSection}>
          <h4 className={styles.infoSectionTitle}>Goals & Interests</h4>
          <div className={styles.infoGrid}>
            <div className={styles.infoItemFull}><span className={styles.infoLabel}>Goals</span><span className={styles.infoValue}>{contactInfo.goals || '-'}</span></div>
            <div className={styles.infoItemFull}><span className={styles.infoLabel}>Product Interest</span><div className={styles.infoValue}>{renderArrayBadges(contactInfo.productInterest)}</div></div>
          </div>
        </div>

        <div className={styles.infoSection}>
          <h4 className={styles.infoSectionTitle}>Bio</h4>
          <div className={styles.infoGrid}>
            <div className={styles.infoItemFull}>
              <span className={styles.infoValue} style={{ whiteSpace: 'pre-wrap' }}>{contactInfo.bio || <span className={styles.mutedItalic}>No bio provided.</span>}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.slideOutPanel}>
        {detailLoading || !detailData ? (
          <div className={styles.panelLoading}>
            <Skeleton style={{ width: '100%', height: '80px' }} />
            <div style={{ display: 'flex', gap: 'var(--spacing-4)', marginTop: 'var(--spacing-4)' }}>
               <Skeleton style={{ width: '80px', height: '20px' }} />
               <Skeleton style={{ width: '80px', height: '20px' }} />
               <Skeleton style={{ width: '80px', height: '20px' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-3)', marginTop: 'var(--spacing-6)' }}>
              <Skeleton style={{ width: '100%', height: '60px' }} />
              <Skeleton style={{ width: '100%', height: '60px' }} />
            </div>
            <Skeleton style={{ width: '100%', height: '100px', marginTop: 'var(--spacing-6)' }} />
          </div>
        ) : (
          <>
            <div className={styles.panelHeader}>
              <div className={styles.panelHeaderProfile}>
                <div className={styles.avatarCircle}>
                  {detailData.contact.avatarUrl ? <img src={detailData.contact.avatarUrl} className={styles.avatarImage} alt="" /> : detailData.contact.displayName.charAt(0).toUpperCase()}
                </div>
                <div className={styles.panelHeaderInfo}>
                  <h3 className={styles.panelTitle}>{detailData.contact.displayName}</h3>
                  {detailData.contact.source === 'demo_request' && (
                    <p className={styles.tagline}>
                      <Badge variant="warning">Demo request</Badge>
                      {detailData.contact.leadExpertise ? ` ${detailData.contact.leadExpertise}` : ''}
                    </p>
                  )}
                  {detailData.contact.tagline && <p className={styles.tagline}>{detailData.contact.tagline}</p>}
                  <div className={styles.panelContactLinks}>
                    {detailData.contact.mobileNumber && (
                      <>
                        <a href={`tel:+91${detailData.contact.mobileNumber}`} className={styles.phoneLink}>{detailData.contact.mobileNumber}</a>
                        <a href={`https://wa.me/91${detailData.contact.mobileNumber}`} target="_blank" rel="noreferrer" className={styles.waLink}>
                          <MessageCircle size={14} />
                        </a>
                      </>
                    )}
                    {detailData.contact.email && (
                      <a href={`mailto:${detailData.contact.email}`} className={styles.emailLink}>{detailData.contact.email}</a>
                    )}
                  </div>
                </div>
              </div>
              <Button size="icon-sm" variant="ghost" onClick={onClose} className={styles.closePanelBtn}>
                <X size={20} />
              </Button>
            </div>
            
            <div className={styles.panelTabs}>
              <button className={`${styles.tabButton} ${activeTab === 'overview' ? styles.tabButtonActive : ''}`} onClick={() => setActiveTab('overview')}>Overview</button>
              <button className={`${styles.tabButton} ${activeTab === 'timeline' ? styles.tabButtonActive : ''}`} onClick={() => setActiveTab('timeline')}>Timeline</button>
              <button className={`${styles.tabButton} ${activeTab === 'info' ? styles.tabButtonActive : ''}`} onClick={() => setActiveTab('info')}>Info</button>
            </div>

            <div className={styles.panelBody}>
              {activeTab === 'overview' && renderOverview()}
              {activeTab === 'timeline' && renderTimeline()}
              {activeTab === 'info' && renderInfo()}
            </div>
          </>
        )}
      </div>
    </>
  );
};