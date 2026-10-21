// Pure URL builders for "add to calendar" actions - no DOM/React/db imports,
// so this is safe to use from both the public masterclass page (client) and
// the registration endpoint / reminder job (server) when composing email
// placeholders.

const pad = (n: number): string => String(n).padStart(2, "0");

// Google and Outlook's web compose links both want a bare UTC timestamp
// (YYYYMMDDTHHMMSSZ) - no colons, no dashes, no local offset.
const toUtcStamp = (date: Date): string =>
  `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(
    date.getUTCHours()
  )}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;

export interface MasterclassCalendarEvent {
  title: string;
  description: string;
  /**
   * Where attendees go to find the join link. Deliberately the masterclass's
   * own page, not the raw meeting URL: the calendar event can be generated
   * (and the .ics re-downloaded) by anyone who registered, long before the
   * real join link is revealed, and the page is what hands that link out
   * once it is actually time to join.
   */
  pageUrl: string;
  startTime: Date | string;
  durationMinutes?: number | null;
}

const eventWindow = (event: MasterclassCalendarEvent) => {
  const start = new Date(event.startTime);
  const end = new Date(start.getTime() + (event.durationMinutes ?? 60) * 60 * 1000);
  return { start, end };
};

export const googleCalendarUrl = (event: MasterclassCalendarEvent): string => {
  const { start, end } = eventWindow(event);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${toUtcStamp(start)}/${toUtcStamp(end)}`,
    details: event.description,
    location: event.pageUrl,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

export const outlookCalendarUrl = (event: MasterclassCalendarEvent): string => {
  const { start, end } = eventWindow(event);
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: event.title,
    startdt: start.toISOString(),
    enddt: end.toISOString(),
    body: event.description,
    location: event.pageUrl,
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
};

/** Relative API path for the downloadable .ics (Apple Calendar, desktop Outlook, etc.). */
export const masterclassIcsPath = (slug: string): string =>
  `/_api/masterclasses/calendar?slug=${encodeURIComponent(slug)}`;
