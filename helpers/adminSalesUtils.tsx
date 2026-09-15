import { SalesStage, CallDisposition } from "./schema";

export const STAGE_OPTIONS: { value: SalesStage; label: string }[] = [
  { value: "new", label: "New" },
  { value: "follow_up", label: "Follow Up" },
  { value: "qualified", label: "Qualified" },
  { value: "converted", label: "Converted" },
  { value: "not_interested", label: "Not Interested" },
];

export const DISPOSITION_OPTIONS: { value: CallDisposition; label: string }[] = [
  { value: "connected_interested", label: "Connected - Interested" },
  { value: "connected_not_interested", label: "Connected - Not Interested" },
  { value: "callback_requested", label: "Callback Requested" },
  { value: "no_answer", label: "No Answer" },
  { value: "busy", label: "Busy" },
  { value: "voicemail", label: "Voicemail" },
  { value: "wrong_number", label: "Wrong Number" },
  { value: "other", label: "Other" },
];

export const getStageColor = (stage: SalesStage): "warning" | "secondary" | "success" | "destructive" | "default" | "outline" | undefined => {
  switch (stage) {
    case "new": return "default";
    case "follow_up": return "warning";
    case "qualified": return "secondary";
    case "converted": return "success";
    case "not_interested": return "destructive";
    default: return "default";
  }
};

export const getDispositionColor = (disposition: CallDisposition | null): "success" | "warning" | "destructive" | "default" | "secondary" => {
  switch (disposition) {
    case "connected_interested": return "success";
    case "connected_not_interested": return "destructive";
    case "callback_requested": return "warning";
    case "busy":
    case "no_answer":
    case "voicemail":
      return "secondary";
    case "wrong_number": return "destructive";
    default: return "default";
  }
};

export const getDispositionLabel = (disposition: CallDisposition | null) => {
  if (!disposition) return "None";
  return DISPOSITION_OPTIONS.find(opt => opt.value === disposition)?.label || disposition;
};

export const formatDate = (date: Date | null | string): string => {
  if (!date) return "N/A";
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
};

export const formatDateTime = (date: Date | null | string): string => {
  if (!date) return "N/A";
  return new Date(date).toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatRelativeTime = (date: Date | null | string): string => {
  if (!date) return "Never";
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHrs = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHrs / 24);

  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
};

export const getContactUrgency = (contact: { stage: SalesStage; followUpDate: Date | null | string; lastContactedAt: Date | null | string }): "overdue" | "today" | "new" | "normal" => {
  if (contact.followUpDate) {
    const d = new Date(contact.followUpDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (d < today) return "overdue";
    if (d >= today && d < tomorrow) return "today";
  }
  if (contact.stage === "new" && !contact.lastContactedAt) return "new";
  return "normal";
};

export const getFollowUpStatus = (date: Date | null | string) => {
  if (!date) return { label: "—", status: "none" };
  
  const d = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (d < today) return { label: formatDateTime(d), status: "overdue" };
  if (d >= today && d < tomorrow) return { label: formatDateTime(d), status: "today" };
  return { label: formatDateTime(d), status: "future" };
};